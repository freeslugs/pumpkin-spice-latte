// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IERC4626Vault {
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares);
    function convertToAssets(uint256 shares) external view returns (uint256 assets);
    function asset() external view returns (address);
}

/**
 * @title PumpkinSpiceLatte
 * @dev A prize-linked savings account (PLSA) built on top of a Morpho vault (ERC4626-style).
 *      Users deposit a common asset, the contract deposits into the vault
 *      to generate yield, and the accumulated yield is awarded as a prize to a
 *      lucky depositor periodically.
 */
contract PumpkinSpiceLatte {
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
        address _vault,
        uint256 _roundDuration
    ) {
        require(IERC4626Vault(_vault).asset() == _asset, "Vault asset mismatch");
        ASSET = _asset;
        VAULT = _vault;
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
            keccak256(
                abi.encodePacked(block.prevrandao, block.timestamp, address(this), depositors.length)
            )
        ) % depositors.length;
        address winner = depositors[idx];

        // Withdraw prize amount from the vault directly to the winner
        uint256 sharesBurned = IERC4626Vault(VAULT).withdraw(prize, winner, address(this));
        if (sharesBurned > vaultShares) {
            vaultShares = 0;
        } else {
            vaultShares -= sharesBurned;
        }

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
}
