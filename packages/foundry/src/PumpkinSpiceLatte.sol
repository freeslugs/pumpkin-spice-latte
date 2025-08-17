// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ILendingAdapter} from "./interfaces/ILendingAdapter.sol";
import {IRandomnessProvider} from "./interfaces/IRandomnessProvider.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title PumpkinSpiceLatte
 * @dev A prize-linked savings account (PLSA) built on top of a lending adapter (ERC4626-style behind an adapter).
 *      Users deposit a common asset, the contract deposits via the adapter to generate yield, and the accumulated
 *      yield is awarded as a prize to a lucky depositor periodically.
 */
contract PumpkinSpiceLatte is Ownable {
    using SafeERC20 for IERC20;
    //-//////////////////////////////////////////////////////////
    //                           STATE
    //-//////////////////////////////////////////////////////////

    /// @dev The underlying ERC20 asset being deposited and supplied via the lending adapter.
    address public immutable ASSET;

    /// @dev Lending adapter implementing ERC4626-like interface.
    ILendingAdapter public immutable LENDING_ADAPTER;

    /// @dev Randomness provider adapter.
    IRandomnessProvider public randomnessProvider;

    /// @dev Timestamp of the last drawing attempt (successful or not).
    uint256 public timestampLastDrawing;

    /// @dev Timestamp when a winner was last selected.
    uint256 public timestampLastWinner;

    /// @dev Base reward half-life (in seconds). After this time since the last drawing, base chance is 50%.
    uint256 public baseRewardHalfLife;

    /// @dev Half-life of the half-life. After every `halfLife2` elapsed since the last winner,
    ///      the effective half-life is cut in half.
    uint256 public halfLife2;

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

    //-//////////////////////////////////////////////////////////
    //                          EVENTS
    //-//////////////////////////////////////////////////////////

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event PrizeAwarded(address indexed winner, uint256 amount);
    event PrizeNotAwarded(address indexed caller);
    event RandomnessProviderUpdated(address indexed newProvider);
    event HalfLifeParamsUpdated(uint256 baseRewardHalfLife, uint256 halfLife2);

    //-//////////////////////////////////////////////////////////
    //                        CONSTRUCTOR
    //-//////////////////////////////////////////////////////////

    constructor(address _adapter, address _randomnessProvider, uint256 _baseRewardHalfLife, uint256 _halfLife2)
        Ownable(msg.sender)
    {
        ASSET = ILendingAdapter(_adapter).asset();
        LENDING_ADAPTER = ILendingAdapter(_adapter);
        randomnessProvider = IRandomnessProvider(_randomnessProvider);
        require(_baseRewardHalfLife > 0, "baseRewardHalfLife must be > 0");
        require(_halfLife2 > 0, "halfLife2 must be > 0");
        baseRewardHalfLife = _baseRewardHalfLife;
        halfLife2 = _halfLife2;
        timestampLastDrawing = block.timestamp;
        timestampLastWinner = block.timestamp;
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

        // Pull funds from user into this contract (supports non-standard ERC20s)
        IERC20(ASSET).safeTransferFrom(msg.sender, address(this), _amount);
        // Approve adapter to pull from this contract and deposit; forceApprove handles zero-first tokens
        SafeERC20.forceApprove(IERC20(ASSET), address(LENDING_ADAPTER), _amount);
        uint256 sharesOut = LENDING_ADAPTER.deposit(_amount);
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

        // Withdraw from adapter directly to the user
        uint256 sharesBurned = LENDING_ADAPTER.withdraw(_amount, msg.sender);
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
     * @notice Attempts to award the current prize pool to a random depositor based on a time-decaying threshold.
     * @dev Can be called at any time. If the random draw does not pass the threshold, no prize is awarded.
     */
    function awardPrize() external {
        require(depositors.length > 0, "No depositors available");

        // Draw a random number once and reuse it for threshold decision and winner selection
        uint256 r = randomnessProvider.randomUint256(bytes32(depositors.length));

        // Compute deterministic, smoothly interpolated threshold
        uint256 threshold = _currentWinThreshold();

        if (r >= threshold) {
            // Did not pass threshold; update last drawing timestamp and exit
            timestampLastDrawing = block.timestamp;
            emit PrizeNotAwarded(msg.sender);
            return;
        }

        uint256 prize = prizePool();
        if (prize == 0) {
            // Nothing to award; do not revert to allow spammable calls
            return;
        }

        // Select winner using the same random draw
        uint256 idx = r % depositors.length;
        address winner = depositors[idx];

        // Credit the winner's principal balance with the prize, keeping assets in the adapter
        balanceOf[winner] += prize;
        totalPrincipal += prize;

        lastWinner = winner;
        lastPrizeAmount = prize;
        timestampLastWinner = block.timestamp;

        emit PrizeAwarded(winner, prize);

        // Update last drawing timestamp after a successful draw as well
        timestampLastDrawing = block.timestamp;
    }

    //-//////////////////////////////////////////////////////////
    //                    OWNER-ONLY FUNCTIONS
    //-//////////////////////////////////////////////////////////

    function setRandomnessProvider(address _provider) external onlyOwner {
        require(_provider != address(0), "Invalid provider");
        randomnessProvider = IRandomnessProvider(_provider);
        emit RandomnessProviderUpdated(_provider);
    }

    function setHalfLifeParams(uint256 _baseRewardHalfLife, uint256 _halfLife2) external onlyOwner {
        require(_baseRewardHalfLife > 0, "baseRewardHalfLife must be > 0");
        require(_halfLife2 > 0, "halfLife2 must be > 0");
        baseRewardHalfLife = _baseRewardHalfLife;
        halfLife2 = _halfLife2;
        emit HalfLifeParamsUpdated(_baseRewardHalfLife, _halfLife2);
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
     *         including principal and yield generated via the adapter.
     * @return The total asset balance.
     */
    function totalAssets() public view returns (uint256) {
        if (vaultShares == 0) return 0;
        return LENDING_ADAPTER.convertToAssets(vaultShares);
    }

    /**
     * @notice Calculates the current prize pool amount.
     * @return The prize amount, which is the yield generated so far.
     */
    function prizePool() public view returns (uint256) {
        uint256 ta = totalAssets();
        return ta > totalPrincipal ? (ta - totalPrincipal) : 0;
    }

    /**
     * @notice Returns the number of unique depositors.
     */
    function numberOfDepositors() public view returns (uint256) {
        return depositors.length;
    }

    // Back-compat: expose a vault() view that returns the adapter address
    function vault() external view returns (address) {
        return address(LENDING_ADAPTER);
    }

    /// @notice Returns the current effective half-life after accounting for time since last winner.
    function currentEffectiveHalfLife() external view returns (uint256) {
        return _effectiveHalfLife();
    }

    /// @notice Returns the current win probability as a WAD (1e18 precision).
    /// @dev Probability p is computed from the current threshold T as p = T / 2^256.
    function currentWinProbability() external view returns (uint256) {
        uint256 threshold = _currentWinThreshold();
        return Math.mulDiv(threshold, 1e18, type(uint256).max);
    }

    /// @notice Returns the current threshold used to determine whether a prize is awarded.
    function currentWinThreshold() external view returns (uint256) {
        return _currentWinThreshold();
    }

    //-//////////////////////////////////////////////////////////
    //                      INTERNAL VIEWS
    //-//////////////////////////////////////////////////////////

    function _effectiveHalfLife() internal view returns (uint256) {
        // Decrease half-life over time since the last winner, halving every `halfLife2`
        uint256 sinceWinner = block.timestamp - timestampLastWinner;
        uint256 halves = sinceWinner / halfLife2;
        if (halves > 255) halves = 255; // avoid oversized shifts
        uint256 hl = baseRewardHalfLife >> halves;
        if (hl == 0) hl = 1; // clamp to at least 1 to avoid division by zero
        return hl;
    }

    function _currentWinThreshold() internal view returns (uint256) {
        uint256 hl = _effectiveHalfLife();
        uint256 elapsed = block.timestamp - timestampLastDrawing;
        uint256 n = elapsed / hl; // number of completed half-lives
        uint256 rem = elapsed % hl; // remainder within the current half-life

        if (n >= 256) {
            return type(uint256).max; // effectively guaranteed win
        }

        // t0 = threshold at integer n
        uint256 t0;
        if (n == 0) {
            t0 = 0;
        } else {
            uint256 pow0 = uint256(1) << (256 - n);
            unchecked {
                t0 = type(uint256).max - (pow0 - 1);
            }
        }

        // If exactly on boundary, no interpolation
        if (rem == 0) {
            return t0;
        }

        // t1 - t0 = 2^(256 - (n + 1))
        uint256 pow1 = uint256(1) << (256 - (n + 1));
        uint256 delta = pow1;

        // Interpolate: threshold = t0 + delta * rem / hl
        uint256 interp = Math.mulDiv(delta, rem, hl);
        unchecked {
            return t0 + interp;
        }
    }
}
