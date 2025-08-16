// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseHook} from "@openzeppelin/uniswap-hooks/src/base/BaseHook.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {BalanceDelta} from "v4-core/src/types/BalanceDelta.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {PoolId} from "v4-core/src/types/PoolId.sol";
import {SwapParams, ModifyLiquidityParams} from "v4-core/src/types/PoolOperation.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {CurrencySettler} from "@openzeppelin/uniswap-hooks/src/utils/CurrencySettler.sol";

interface IERC4626Vault {
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares);
    function convertToAssets(uint256 shares) external view returns (uint256 assets);
    function asset() external view returns (address);
}

/**
 * @title PumpkinSpiceLatteV4Hook
 * @dev A unified Uniswap V4 hook that combines prize-linked savings account (PLSA)
 *      functionality with DeFi trading fee capture. Users get yield from Morpho vaults
 *      and trading fees from Uniswap V4 pools, with periodic prize distributions.
 */
contract PumpkinSpiceLatteV4Hook is BaseHook {
    using CurrencySettler for Currency;

    //-//////////////////////////////////////////////////////////
    //                        HELPER FUNCTIONS
    //-//////////////////////////////////////////////////////////

    /**
     * @dev Helper function to get the absolute value of an int128 as uint256.
     */
    function _abs(int128 value) private pure returns (uint256) {
        return value > 0 ? uint256(uint128(value)) : uint256(uint128(-value));
    }

    //-//////////////////////////////////////////////////////////
    //                           STATE
    //-//////////////////////////////////////////////////////////

    /// @dev The underlying ERC20 asset being deposited and supplied to the vault.
    address public immutable ASSET;

    /// @dev The Morpho vault (ERC4626-style) contract address.
    address public immutable VAULT;

    /// @dev The duration of each prize round in seconds.
    uint256 public roundDuration;

    /// @dev The timestamp when the next prize round ends.
    uint256 public nextRoundTimestamp;

    /// @dev The total principal amount deposited by all users. This should only
    //      increase on deposit and decrease on withdraw.
    uint256 public totalPrincipal;

    /// @dev Mapping from user address to their principal balance.
    mapping(address => uint256) public balanceOf;

    /// @dev Array of all unique depositors, used for the prize draw.
    address[] public depositors;

    /// @dev Mapping to track the index of a depositor in the `depositors` array for O(1) removal.
    mapping(address => uint256) private depositorIndex;

    /// @dev The winner of the last prize round.
    address public lastWinner;

    /// @dev The amount of the last prize awarded.
    uint256 public lastPrizeAmount;

    /// @dev The number of vault shares owned by this contract.
    uint256 public vaultShares;

    /// @dev Mapping from pool ID to accumulated fees for the current round.
    mapping(PoolId => uint256) public poolFees;

    /// @dev The total fees accumulated in the current round.
    uint256 public currentRoundFees;

    /// @dev Mapping from pool ID to the last checkpoint of fees.
    mapping(PoolId => uint256) public lastFeeCheckpoint;

    /// @dev Mapping from liquidity provider to their total liquidity across all pools.
    mapping(address => uint256) public userLiquidity;

    /// @dev Array of all unique liquidity providers.
    address[] public liquidityProviders;

    /// @dev Mapping to track the index of a liquidity provider in the array.
    mapping(address => uint256) private providerIndex;

    /// @dev The percentage of fees that go to liquidity providers as bonus (basis points).
    uint256 public liquidityProviderBonusBps;

    /// @dev The percentage of fees that go to the prize pool (basis points).
    uint256 public constant PRIZE_POOL_FEE_BPS = 8000; // 80%

    //-//////////////////////////////////////////////////////////
    //                          EVENTS
    //-//////////////////////////////////////////////////////////

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event PrizeAwarded(address indexed winner, uint256 amount);
    event FeesAccumulated(PoolId indexed poolId, uint256 fees);
    event LiquidityProviderAdded(address indexed provider, uint256 liquidity);
    event LiquidityProviderRemoved(address indexed provider, uint256 liquidity);
    event LiquidityProviderBonus(address indexed provider, uint256 bonus);

    //-//////////////////////////////////////////////////////////
    //                        CONSTRUCTOR
    //-//////////////////////////////////////////////////////////

    constructor(
        IPoolManager _poolManager,
        address _asset,
        address _vault,
        uint256 _roundDuration,
        uint256 _liquidityProviderBonusBps
    ) BaseHook(_poolManager) {
        require(IERC4626Vault(_vault).asset() == _asset, "Vault asset mismatch");
        require(_liquidityProviderBonusBps <= 2000, "LP bonus too high"); // Max 20%

        ASSET = _asset;
        VAULT = _vault;
        roundDuration = _roundDuration;
        nextRoundTimestamp = block.timestamp + _roundDuration;
        liquidityProviderBonusBps = _liquidityProviderBonusBps;
    }

    //-//////////////////////////////////////////////////////////
    //                     HOOK PERMISSIONS
    //-//////////////////////////////////////////////////////////

    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeAddLiquidity: true,
            afterAddLiquidity: true,
            beforeRemoveLiquidity: true,
            afterRemoveLiquidity: true,
            beforeSwap: false,
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
    //                     USER-FACING FUNCTIONS
    //-//////////////////////////////////////////////////////////

    /**
     * @notice Deposits assets into the PLSA.
     * @param _amount The amount of `asset` to deposit.
     * @dev The caller must have approved the contract to spend `_amount` of `asset`.
     */
    function deposit(uint256 _amount) external {
        require(_amount > 0, "Deposit amount must be greater than zero");

        if (balanceOf[msg.sender] == 0) {
            depositors.push(msg.sender);
            depositorIndex[msg.sender] = depositors.length - 1;
        }

        balanceOf[msg.sender] += _amount;
        totalPrincipal += _amount;

        emit Deposited(msg.sender, _amount);

        // Pull funds from user
        require(IERC20(ASSET).transferFrom(msg.sender, address(this), _amount), "Transfer failed");

        // Approve and deposit into the vault on behalf of this contract
        require(IERC20(ASSET).approve(VAULT, _amount), "Approval failed");
        uint256 sharesOut = IERC4626Vault(VAULT).deposit(_amount, address(this));
        vaultShares += sharesOut;
    }

    /**
     * @notice Withdraws principal from the PLSA.
     * @param _amount The amount of `asset` to withdraw.
     * @dev Users can only withdraw up to their deposited principal.
     */
    function withdraw(uint256 _amount) external {
        require(_amount > 0, "Withdraw amount must be greater than zero");
        uint256 userBalance = balanceOf[msg.sender];
        require(userBalance >= _amount, "Insufficient balance");

        // Note: This check implicitly protects the prize pool. Users can only withdraw
        // their principal, not the yield generated from it.
        require(totalAssets() >= totalPrincipal, "Contract is undercollateralized");

        balanceOf[msg.sender] -= _amount;
        totalPrincipal -= _amount;

        if (userBalance - _amount == 0) {
            _removeDepositor(msg.sender);
        }

        emit Withdrawn(msg.sender, _amount);

        // Withdraw from vault directly to the user
        uint256 sharesBurned = IERC4626Vault(VAULT).withdraw(_amount, msg.sender, address(this));
        if (sharesBurned > vaultShares) {
            vaultShares = 0;
        } else {
            vaultShares -= sharesBurned;
        }
    }

    //-//////////////////////////////////////////////////////////
    //                    PRIZE-RELATED FUNCTIONS
    //-//////////////////////////////////////////////////////////

    /**
     * @notice Calculates the total yield generated and awards it to a random depositor.
     * @dev Can be called by anyone after the `nextRoundTimestamp` has passed.
     */
    function awardPrize() external {
        require(block.timestamp >= nextRoundTimestamp, "Round not finished");
        require(depositors.length > 0, "No depositors");

        uint256 prize = prizePool();
        require(prize > 0, "No prize to award");

        // Pseudo-random selection (not secure; for testnet/demo)
        uint256 idx = uint256(
            keccak256(abi.encodePacked(block.prevrandao, block.timestamp, address(this), depositors.length))
        ) % depositors.length;
        address winner = depositors[idx];

        // Credit the winner's principal balance with the prize, keeping assets in the vault
        balanceOf[winner] += prize;
        totalPrincipal += prize;

        lastWinner = winner;
        lastPrizeAmount = prize;
        nextRoundTimestamp = block.timestamp + roundDuration;

        emit PrizeAwarded(winner, prize);
    }

    //-//////////////////////////////////////////////////////////
    //                  INTERNAL HELPER FUNCTIONS
    //-//////////////////////////////////////////////////////////

    /**
     * @dev Removes a depositor from the `depositors` array.
     *      Uses the swap-and-pop technique for O(1) removal.
     */
    function _removeDepositor(address _depositor) private {
        uint256 index = depositorIndex[_depositor];
        address lastDepositor = depositors[depositors.length - 1];

        // If the depositor to remove is not the last one, swap it
        if (index < depositors.length - 1) {
            depositors[index] = lastDepositor;
            depositorIndex[lastDepositor] = index;
        }

        // Remove the last element
        depositors.pop();
        delete depositorIndex[_depositor];
    }

    //-//////////////////////////////////////////////////////////
    //                         VIEW FUNCTIONS
    //-//////////////////////////////////////////////////////////

    /**
     * @notice Calculates the total value of assets held by this contract,
     *         including principal and yield generated via the vault.
     * @return The total asset balance.
     */
    function totalAssets() public view returns (uint256) {
        if (vaultShares == 0) return 0;
        return IERC4626Vault(VAULT).convertToAssets(vaultShares);
    }

    /**
     * @notice Calculates the current prize pool amount.
     * @return The prize amount, which is the yield generated so far plus accumulated fees.
     */
    function prizePool() public view returns (uint256) {
        uint256 ta = totalAssets();
        uint256 yield = ta > totalPrincipal ? (ta - totalPrincipal) : 0;
        return yield + currentRoundFees;
    }

    /**
     * @notice Returns the number of unique depositors.
     */
    function numberOfDepositors() public view returns (uint256) {
        return depositors.length;
    }

    /**
     * @notice Returns the time remaining until the next prize draw.
     */
    function timeUntilNextPrize() public view returns (uint256) {
        if (block.timestamp >= nextRoundTimestamp) {
            return 0;
        }
        return nextRoundTimestamp - block.timestamp;
    }

    /**
     * @notice Returns the depositors array.
     */
    function getDepositors() public view returns (address[] memory) {
        return depositors;
    }

    //-//////////////////////////////////////////////////////////
    //                     LIQUIDITY HOOKS
    //-//////////////////////////////////////////////////////////

    /**
     * @dev Hook called before adding liquidity.
     *      Validates the liquidity addition.
     */
    function _beforeAddLiquidity(
        address sender,
        PoolKey calldata key,
        ModifyLiquidityParams calldata params,
        bytes calldata hookData
    ) internal override returns (bytes4) {
        // No specific logic needed before adding liquidity
        return BaseHook.beforeAddLiquidity.selector;
    }

    /**
     * @dev Hook called after adding liquidity.
     *      Updates tracking for the liquidity provider.
     */
    function _afterAddLiquidity(
        address sender,
        PoolKey calldata key,
        ModifyLiquidityParams calldata params,
        BalanceDelta delta0,
        BalanceDelta delta1,
        bytes calldata hookData
    ) internal override returns (bytes4, BalanceDelta) {
        // Calculate the liquidity value (simplified - using delta0 as proxy)
        int128 amount0 = delta0.amount0();
        uint256 liquidityValue = _abs(amount0);

        if (liquidityValue > 0) {
            _addLiquidityProvider(sender, liquidityValue);
        }

        return (BaseHook.afterAddLiquidity.selector, BalanceDelta.wrap(0));
    }

    /**
     * @dev Hook called before removing liquidity.
     *      Validates the liquidity removal.
     */
    function _beforeRemoveLiquidity(
        address sender,
        PoolKey calldata key,
        ModifyLiquidityParams calldata params,
        bytes calldata hookData
    ) internal override returns (bytes4) {
        // No specific logic needed before removing liquidity
        return BaseHook.beforeRemoveLiquidity.selector;
    }

    /**
     * @dev Hook called after removing liquidity.
     *      Updates tracking for the liquidity provider.
     */
    function _afterRemoveLiquidity(
        address sender,
        PoolKey calldata key,
        ModifyLiquidityParams calldata params,
        BalanceDelta delta0,
        BalanceDelta delta1,
        bytes calldata hookData
    ) internal override returns (bytes4, BalanceDelta) {
        // Calculate the liquidity value being removed
        int128 amount0 = delta0.amount0();
        uint256 liquidityValue = _abs(amount0);

        if (liquidityValue > 0) {
            _removeLiquidityProvider(sender, liquidityValue);
        }

        return (BaseHook.afterRemoveLiquidity.selector, BalanceDelta.wrap(0));
    }

    //-//////////////////////////////////////////////////////////
    //                     SWAP HOOKS
    //-//////////////////////////////////////////////////////////

    /**
     * @dev Hook called after swaps to capture fees.
     *      Accumulates fees for the current prize round.
     */
    function _afterSwap(
        address sender,
        PoolKey calldata key,
        SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata hookData
    ) internal override returns (bytes4, int128) {
        PoolId poolId = key.toId();

        // Calculate fees from the swap
        uint256 fees = _calculateSwapFees(poolId, delta);

        if (fees > 0) {
            poolFees[poolId] += fees;
            currentRoundFees += fees;

            emit FeesAccumulated(poolId, fees);
        }

        return (BaseHook.afterSwap.selector, 0);
    }

    //-//////////////////////////////////////////////////////////
    //                    LIQUIDITY PROVIDER FUNCTIONS
    //-//////////////////////////////////////////////////////////

    /**
     * @dev Adds liquidity from a provider and adds them if they're new.
     */
    function _addLiquidityProvider(address provider, uint256 liquidity) private {
        if (userLiquidity[provider] == 0) {
            liquidityProviders.push(provider);
            providerIndex[provider] = liquidityProviders.length - 1;
        }

        userLiquidity[provider] += liquidity;

        emit LiquidityProviderAdded(provider, liquidity);
    }

    /**
     * @dev Removes liquidity from a provider and removes them if they have no liquidity left.
     */
    function _removeLiquidityProvider(address provider, uint256 liquidity) private {
        require(userLiquidity[provider] >= liquidity, "Insufficient liquidity");

        userLiquidity[provider] -= liquidity;

        if (userLiquidity[provider] == 0) {
            _removeProviderFromArray(provider);
        }

        emit LiquidityProviderRemoved(provider, liquidity);
    }

    /**
     * @dev Removes a liquidity provider from the array.
     */
    function _removeProviderFromArray(address provider) private {
        uint256 index = providerIndex[provider];
        address lastProvider = liquidityProviders[liquidityProviders.length - 1];

        if (index < liquidityProviders.length - 1) {
            liquidityProviders[index] = lastProvider;
            providerIndex[lastProvider] = index;
        }

        liquidityProviders.pop();
        delete providerIndex[provider];
    }

    /**
     * @dev Calculates fees from a swap operation.
     *      This is a simplified calculation - in practice, you'd need more sophisticated logic.
     */
    function _calculateSwapFees(PoolId poolId, BalanceDelta delta) private view returns (uint256) {
        // Simplified fee calculation - in practice, you'd need to track actual fees
        // This is just a placeholder that returns a small amount based on the swap size
        int128 amount0 = delta.amount0();
        int128 amount1 = delta.amount1();
        uint256 swapSize = _abs(amount0) + _abs(amount1);
        return swapSize / 1000; // 0.1% fee approximation
    }

    /**
     * @notice Returns the number of unique liquidity providers.
     */
    function numberOfLiquidityProviders() public view returns (uint256) {
        return liquidityProviders.length;
    }

    /**
     * @notice Returns the liquidity providers array.
     */
    function getLiquidityProviders() public view returns (address[] memory) {
        return liquidityProviders;
    }

    //-//////////////////////////////////////////////////////////
    //                     ADMIN FUNCTIONS
    //-//////////////////////////////////////////////////////////

    /**
     * @notice Allows the contract to receive ETH (for prize distribution).
     */
    receive() external payable {}
}
