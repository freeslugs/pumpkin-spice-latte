// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseHook} from "@openzeppelin/uniswap-hooks/src/base/BaseHook.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {BalanceDelta} from "v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta} from "v4-core/src/types/BeforeSwapDelta.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {SwapParams, ModifyLiquidityParams} from "v4-core/src/types/PoolOperation.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface IPumpkinSpiceLatte {
    function handleLiquidityAdded(address provider, uint256 amount) external;
    function handleLiquidityRemoved(address provider, uint256 amount) external;
    function requestLiquidity(uint256 amount) external returns (uint256 available);
    function depositSwapFees(uint256 amount) external;
    function rebalanceExcess(uint256 amount) external;
    function isProvider(address provider) external view returns (bool);
    function ASSET() external view returns (address);
}

/**
 * @title PumpkinSpiceLatteV4Hook
 * @dev Lightweight Uniswap V4 hook that interfaces with PumpkinSpiceLatte PLSA contract.
 *      This hook focuses only on V4 integration while delegating all business logic
 *      to the dedicated PLSA contract.
 *
 * Responsibilities:
 * - Capture V4 hook events (add/remove liquidity, swaps)
 * - Forward relevant data to PLSA contract
 * - Request liquidity from PLSA when needed for swaps
 * - Simple fee capture and forwarding
 */
contract PumpkinSpiceLatteV4Hook is BaseHook, Ownable {
    using PoolIdLibrary for PoolKey;

    //-//////////////////////////////////////////////////////////
    //                           STATE
    //-//////////////////////////////////////////////////////////

    /// @dev The PLSA contract that handles all business logic
    IPumpkinSpiceLatte public immutable PLSA_CONTRACT;

    /// @dev The primary asset for this hook (USDC)
    Currency public immutable PRIMARY_CURRENCY;

    /// @dev Fee percentage captured for PLSA (basis points)
    uint256 public constant FEE_CAPTURE_BPS = 2000; // 20% of swap fees

    /// @dev Mapping from pool to accumulated fees
    mapping(PoolId => uint256) public poolFees;

    /// @dev Emergency pause
    bool public paused = false;

    //-//////////////////////////////////////////////////////////
    //                          EVENTS
    //-//////////////////////////////////////////////////////////

    event LiquidityHandled(address indexed provider, uint256 amount, bool isAdd);
    event SwapFeesCaptured(PoolId indexed poolId, uint256 amount);
    event LiquidityRequested(uint256 requested, uint256 available);
    event EmergencyPaused(bool paused);

    //-//////////////////////////////////////////////////////////
    //                        MODIFIERS
    //-//////////////////////////////////////////////////////////

    modifier whenNotPaused() {
        require(!paused, "Hook is paused");
        _;
    }

    //-//////////////////////////////////////////////////////////
    //                        CONSTRUCTOR
    //-//////////////////////////////////////////////////////////

    constructor(IPoolManager _poolManager, address _plsaContract) BaseHook(_poolManager) Ownable(msg.sender) {
        require(_plsaContract != address(0), "Invalid PLSA contract");

        PLSA_CONTRACT = IPumpkinSpiceLatte(_plsaContract);
        PRIMARY_CURRENCY = Currency.wrap(PLSA_CONTRACT.ASSET());
    }

    //-//////////////////////////////////////////////////////////
    //                     HOOK PERMISSIONS
    //-//////////////////////////////////////////////////////////

    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: true,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: true,
            beforeSwap: true,
            afterSwap: true,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    //-//////////////////////////////////////////////////////////
    //                    HOOK IMPLEMENTATIONS
    //-//////////////////////////////////////////////////////////

    /**
     * @dev Hook called after adding liquidity - notify PLSA contract
     */
    function _afterAddLiquidity(
        address sender,
        PoolKey calldata, /* key */
        ModifyLiquidityParams calldata, /* params */
        BalanceDelta delta0,
        BalanceDelta delta1,
        bytes calldata /* hookData */
    ) internal override whenNotPaused returns (bytes4, BalanceDelta) {
        // Calculate liquidity value (simplified for primary currency)
        uint256 liquidityValue = _calculateLiquidityValue(delta0, delta1);

        if (liquidityValue > 0) {
            // Notify PLSA contract about new liquidity
            PLSA_CONTRACT.handleLiquidityAdded(sender, liquidityValue);
            emit LiquidityHandled(sender, liquidityValue, true);
        }

        return (BaseHook.afterAddLiquidity.selector, BalanceDelta.wrap(0));
    }

    /**
     * @dev Hook called after removing liquidity - notify PLSA contract
     */
    function _afterRemoveLiquidity(
        address sender,
        PoolKey calldata, /* key */
        ModifyLiquidityParams calldata, /* params */
        BalanceDelta delta0,
        BalanceDelta delta1,
        bytes calldata /* hookData */
    ) internal override whenNotPaused returns (bytes4, BalanceDelta) {
        // Calculate liquidity value being removed
        uint256 liquidityValue = _calculateLiquidityValue(delta0, delta1);

        if (liquidityValue > 0) {
            // Notify PLSA contract about liquidity removal
            PLSA_CONTRACT.handleLiquidityRemoved(sender, liquidityValue);
            emit LiquidityHandled(sender, liquidityValue, false);
        }

        return (BaseHook.afterRemoveLiquidity.selector, BalanceDelta.wrap(0));
    }

    /**
     * @dev Hook called before swaps - ensure sufficient liquidity
     */
    function _beforeSwap(
        address, /* sender */
        PoolKey calldata, /* key */
        SwapParams calldata params,
        bytes calldata /* hookData */
    ) internal override whenNotPaused returns (bytes4, BeforeSwapDelta, uint24) {
        // Calculate required liquidity for this swap
        uint256 requiredLiquidity = _calculateSwapLiquidity(params);

        if (requiredLiquidity > 0) {
            // Request liquidity from PLSA contract
            uint256 available = PLSA_CONTRACT.requestLiquidity(requiredLiquidity);
            emit LiquidityRequested(requiredLiquidity, available);
        }

        return (BaseHook.beforeSwap.selector, BeforeSwapDelta.wrap(0), 0);
    }

    /**
     * @dev Hook called after swaps - capture fees and rebalance
     */
    function _afterSwap(
        address, /* sender */
        PoolKey calldata key,
        SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata /* hookData */
    ) internal override whenNotPaused returns (bytes4, int128) {
        PoolId poolId = key.toId();

        // Calculate and capture fees
        uint256 fees = _calculateSwapFees(key, params, delta);
        if (fees > 0) {
            poolFees[poolId] += fees;

            // Forward fees to PLSA contract
            PLSA_CONTRACT.depositSwapFees(fees);
            emit SwapFeesCaptured(poolId, fees);
        }

        // Calculate any excess liquidity that can be rebalanced
        uint256 excessLiquidity = _calculateExcessLiquidity(params);
        if (excessLiquidity > 0) {
            PLSA_CONTRACT.rebalanceExcess(excessLiquidity);
        }

        return (BaseHook.afterSwap.selector, 0);
    }

    //-//////////////////////////////////////////////////////////
    //                    INTERNAL HELPERS
    //-//////////////////////////////////////////////////////////

    /**
     * @dev Calculate liquidity value from balance deltas
     */
    function _calculateLiquidityValue(BalanceDelta delta0, BalanceDelta delta1) internal pure returns (uint256) {
        // Simplified calculation - sum absolute values
        uint256 amount0 =
            delta0.amount0() > 0 ? uint256(uint128(delta0.amount0())) : uint256(uint128(-delta0.amount0()));
        uint256 amount1 =
            delta1.amount1() > 0 ? uint256(uint128(delta1.amount1())) : uint256(uint128(-delta1.amount1()));
        return amount0 + amount1;
    }

    /**
     * @dev Calculate required liquidity for a swap
     */
    function _calculateSwapLiquidity(SwapParams calldata params) internal pure returns (uint256) {
        if (params.amountSpecified > 0) {
            // Exact input swap
            return uint256(params.amountSpecified);
        } else {
            // Exact output swap - estimate with buffer
            return uint256(-params.amountSpecified) * 110 / 100; // 10% buffer
        }
    }

    /**
     * @dev Calculate swap fees to capture
     */
    function _calculateSwapFees(PoolKey calldata key, SwapParams calldata params, BalanceDelta delta)
        internal
        pure
        returns (uint256)
    {
        // Get swap amount
        uint256 swapAmount;
        if (params.amountSpecified > 0) {
            swapAmount = uint256(params.amountSpecified);
        } else {
            int128 inputAmount = params.zeroForOne ? delta.amount0() : delta.amount1();
            swapAmount = inputAmount > 0 ? uint256(uint128(inputAmount)) : uint256(uint128(-inputAmount));
        }

        // Calculate total fee and take our share
        uint256 totalFees = (swapAmount * key.fee) / 1000000;
        return (totalFees * FEE_CAPTURE_BPS) / 10000;
    }

    /**
     * @dev Calculate excess liquidity that can be rebalanced
     */
    function _calculateExcessLiquidity(SwapParams calldata params) internal pure returns (uint256) {
        // Simplified: assume 10% of swap amount becomes excess
        // In reality, this would be more sophisticated
        uint256 swapAmount =
            params.amountSpecified > 0 ? uint256(params.amountSpecified) : uint256(-params.amountSpecified);

        return swapAmount / 10; // 10% excess assumption
    }

    //-//////////////////////////////////////////////////////////
    //                         VIEW FUNCTIONS
    //-//////////////////////////////////////////////////////////

    /**
     * @notice Get accumulated fees for a pool
     */
    function getPoolFees(PoolId poolId) external view returns (uint256) {
        return poolFees[poolId];
    }

    /**
     * @notice Check if an address is a liquidity provider
     */
    function isLiquidityProvider(address provider) external view returns (bool) {
        return PLSA_CONTRACT.isProvider(provider);
    }

    /**
     * @notice Get the primary asset for this hook
     */
    function getPrimaryAsset() external view returns (address) {
        return Currency.unwrap(PRIMARY_CURRENCY);
    }

    //-//////////////////////////////////////////////////////////
    //                      ADMIN FUNCTIONS
    //-//////////////////////////////////////////////////////////

    /**
     * @notice Emergency pause function
     */
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit EmergencyPaused(_paused);
    }

    /**
     * @notice Emergency function to reset pool fees (if needed)
     */
    function resetPoolFees(PoolId poolId) external onlyOwner {
        require(paused, "Must be paused");
        poolFees[poolId] = 0;
    }
}
