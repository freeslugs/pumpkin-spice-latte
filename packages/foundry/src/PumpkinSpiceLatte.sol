// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ILendingAdapter} from "./interfaces/ILendingAdapter.sol";
import {IRandomnessProvider} from "./interfaces/IRandomnessProvider.sol";

/**
 * @title PumpkinSpiceLatte
 * @dev A prize-linked savings account (PLSA) built on top of a lending adapter (ERC4626-style behind an adapter).
 *      Users deposit a common asset, the contract deposits via the adapter to generate yield, and the accumulated
 *      yield is awarded as a prize to a lucky depositor periodically.
 */
contract PumpkinSpiceLatte is Ownable {
    //-//////////////////////////////////////////////////////////
    //                           STATE
    //-//////////////////////////////////////////////////////////

    /// @dev The underlying ERC20 asset being deposited and supplied via the lending adapter.
    address public immutable ASSET;

    /// @dev Lending adapter implementing ERC4626-like interface.
    ILendingAdapter public immutable LENDING_ADAPTER;

    /// @dev Randomness provider adapter.
    IRandomnessProvider public randomnessProvider;

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

    //-//////////////////////////////////////////////////////////
    //                          EVENTS
    //-//////////////////////////////////////////////////////////

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event PrizeAwarded(address indexed winner, uint256 amount);
    event RoundDurationUpdated(uint256 oldDuration, uint256 newDuration);
    event RandomnessProviderUpdated(address indexed newProvider);

    //-//////////////////////////////////////////////////////////
    //                        CONSTRUCTOR
    //-//////////////////////////////////////////////////////////

    constructor(address _adapter, address _randomnessProvider, uint256 _roundDuration) Ownable(msg.sender) {
    ASSET = ILendingAdapter(_adapter).asset();
    LENDING_ADAPTER = ILendingAdapter(_adapter);
    randomnessProvider = IRandomnessProvider(_randomnessProvider);
    require(_roundDuration > 0, "Duration must be > 0");
    roundDuration = _roundDuration;
    nextRoundTimestamp = block.timestamp + _roundDuration;
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

    // Approve and deposit into the lending adapter on behalf of this contract
    require(IERC20(ASSET).approve(address(LENDING_ADAPTER), _amount), "Approval failed");
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
     * @notice Calculates the total yield generated and awards it to a random depositor.
     * @dev Can be called by anyone after the `nextRoundTimestamp` has passed.
     */
    function awardPrize() external {
    require(block.timestamp >= nextRoundTimestamp, "Round not finished");
    require(depositors.length > 0, "No depositors");

    uint256 prize = prizePool();
    require(prize > 0, "No prize to award");

    // Random selection via adapter
    uint256 idx = randomnessProvider.randomUint256(bytes32(depositors.length)) % depositors.length;
    address winner = depositors[idx];

    // Credit the winner's principal balance with the prize, keeping assets in the adapter
    balanceOf[winner] += prize;
    totalPrincipal += prize;

    lastWinner = winner;
    lastPrizeAmount = prize;
    nextRoundTimestamp = block.timestamp + roundDuration;

    emit PrizeAwarded(winner, prize);
    }

    //-//////////////////////////////////////////////////////////
    //                    OWNER-ONLY FUNCTIONS
    //-//////////////////////////////////////////////////////////

    /**
     * @notice Updates the round duration. Only callable by the contract owner.
     * @param _roundDuration The new round duration in seconds. Must be greater than zero.
     * @dev This change applies to future rounds. The current `nextRoundTimestamp` is not modified.
     */
    function setRoundDuration(uint256 _roundDuration) external onlyOwner {
    require(_roundDuration > 0, "Duration must be > 0");
    uint256 old = roundDuration;
    roundDuration = _roundDuration;
    emit RoundDurationUpdated(old, _roundDuration);
    }

    function setRandomnessProvider(address _provider) external onlyOwner {
    require(_provider != address(0), "Invalid provider");
    randomnessProvider = IRandomnessProvider(_provider);
    emit RandomnessProviderUpdated(_provider);
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

    // Back-compat: expose a VAULT() view that returns the adapter address
    function VAULT() external view returns (address) {
    return address(LENDING_ADAPTER);
    }
}
