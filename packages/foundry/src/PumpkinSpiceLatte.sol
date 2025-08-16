// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IMorpho
 * @dev Interface for the Morpho Blue protocol.
 *      This is a minimal interface containing only the functions needed.
 */
interface IMorpho {
    function supply(
        bytes32 marketId,
        uint256 assets,
        uint256 shares,
        address onBehalf,
        bytes calldata data
    ) external returns (uint256 sharesOut, uint256 assetsOut);

    function withdraw(
        bytes32 marketId,
        uint256 assets,
        uint256 shares,
        address to,
        address owner
    ) external returns (uint256 sharesOut, uint256 assetsOut);

    function market(bytes32 marketId) external view returns (uint128 totalSupplyAssets, uint128 totalSupplyShares, uint128 totalBorrowAssets, uint128 totalBorrowShares, uint128 lastUpdate, uint128 fee);
}

/**
 * @title PumpkinSpiceLatte
 * @dev A prize-linked savings account (PLSA) built on top of Morpho Blue.
 *      Users deposit a common asset, the contract supplies it to a Morpho Blue market
 *      to generate yield, and the accumulated yield is awarded as a prize to a
 *      lucky depositor periodically.
 */
contract PumpkinSpiceLatte {
    //-//////////////////////////////////////////////////////////
    //                           STATE
    //-//////////////////////////////////////////////////////////

    /// @dev The underlying ERC20 asset being deposited and supplied to Morpho.
    address public immutable asset;

    /// @dev The Morpho Blue protocol contract.
    address public immutable morpho;

    /// @dev The specific Morpho Blue market to supply assets to.
    bytes32 public immutable marketId;

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

    //-//////////////////////////////////////////////////////////
    //                          EVENTS
    //-//////////////////////////////////////////////////////////

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event PrizeAwarded(address indexed winner, uint256 amount);

    //-//////////////////////////////////////////////////////////
    //                        CONSTRUCTOR
    //-//////////////////////////////////////////////////////////

    constructor(
        address _asset,
        address _morpho,
        bytes32 _marketId,
        uint256 _roundDuration
    ) {
        asset = _asset;
        morpho = _morpho;
        marketId = _marketId;
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

        // Transfer funds AFTER updating state (checks-effects-interactions)
        IERC20(asset).transferFrom(msg.sender, address(this), _amount);
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

        // Transfer funds AFTER updating state
        IERC20(asset).transfer(msg.sender, _amount);
    }

    //-//////////////////////////////////////////////////////////
    //                    PRIZE-RELATED FUNCTIONS
    //-//////////////////////////////////////////////////////////

    /**
     * @notice Calculates the total yield generated and awards it to a random depositor.
     * @dev Can be called by anyone after the `nextRoundTimestamp` has passed.
     */
    function awardPrize() external {
        // Implementation in next step
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
     *         including principal and yield generated from Morpho.
     * @return The total asset balance.
     */
    function totalAssets() public view returns (uint256) {
        // Implementation in next step
        return 0;
    }

    /**
     * @notice Calculates the current prize pool amount.
     * @return The prize amount, which is the yield generated so far.
     */
    function prizePool() public view returns (uint256) {
        // Implementation in next step
        return 0;
    }

    /**
     * @notice Returns the number of unique depositors.
     */
    function numberOfDepositors() public view returns (uint256) {
        return depositors.length;
    }
}
