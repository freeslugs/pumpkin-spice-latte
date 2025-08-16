// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {VRFConsumerBaseV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";

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
contract PumpkinSpiceLatte is VRFConsumerBaseV2Plus {
    //-//////////////////////////////////////////////////////////
    //                           STATE
    //-//////////////////////////////////////////////////////////

    /// @dev The underlying ERC20 asset being deposited and supplied to the vault.
    address public immutable ASSET;

    /// @dev The Morpho vault (ERC4626-style) contract address.
    address public immutable VAULT;

    /// @dev Timestamp of the last successful prize payout.
    uint256 public lastPrizeTimestamp;

    /// @dev Timestamp of the last prize drawing attempt (VRF request attempt time).
    uint256 public lastDrawingTimestamp;
    
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
    //                          VRF STATE
    //-//////////////////////////////////////////////////////////

    /// @dev Chainlink VRF coordinator address.
    address public immutable VRF_COORDINATOR;

    /// @dev Chainlink VRF keyHash (gas lane).
    bytes32 public immutable VRF_KEY_HASH;

    /// @dev Chainlink VRF subscription id used for funding randomness requests.
    uint256 public immutable VRF_SUBSCRIPTION_ID;

    /// @dev VRF callback gas limit.
    uint32 public immutable VRF_CALLBACK_GAS_LIMIT;

    /// @dev VRF request confirmations.
    uint16 public immutable VRF_REQUEST_CONFIRMATIONS;

    /// @dev Whether there is a pending VRF request.
    bool public vrfRequestPending;
    //-//////////////////////////////////////////////////////////
    //                       PRIZE POLICY STATE
    //-//////////////////////////////////////////////////////////

    /// @dev Base threshold used for d100 comparison (e.g., 10 means d100 < 10 wins).
    uint8 public immutable BASE_THRESHOLD;

    /// @dev Maximum threshold cap (<= 100).
    uint8 public immutable MAX_THRESHOLD;

    /// @dev Time in seconds since the last prize payout required to reach `MAX_THRESHOLD` linearly.
    uint256 public immutable TIME_TO_MAX_THRESHOLD;

    /// @dev Time in seconds for the spam-damping to fully wear off since the last drawing attempt.
    uint256 public immutable DRAW_COOLDOWN;

    /// @dev The last VRF request id issued by this contract.
    uint256 public lastRequestId;

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
        address _vrfCoordinator,
        bytes32 _vrfKeyHash,
        uint256 _vrfSubscriptionId,
        uint32 _vrfCallbackGasLimit,
        uint16 _vrfRequestConfirmations,
        uint8 _baseThreshold,
        uint8 _maxThreshold,
        uint256 _timeToMaxThreshold,
        uint256 _drawCooldown
    ) VRFConsumerBaseV2Plus(_vrfCoordinator) {
        require(IERC4626Vault(_vault).asset() == _asset, "Vault asset mismatch");
        ASSET = _asset;
        VAULT = _vault;
        lastPrizeTimestamp = block.timestamp;
        lastDrawingTimestamp = block.timestamp;

        VRF_COORDINATOR = _vrfCoordinator;
        VRF_KEY_HASH = _vrfKeyHash;
        VRF_SUBSCRIPTION_ID = _vrfSubscriptionId;
        VRF_CALLBACK_GAS_LIMIT = _vrfCallbackGasLimit;
        VRF_REQUEST_CONFIRMATIONS = _vrfRequestConfirmations;

        require(_maxThreshold <= 100 && _baseThreshold <= _maxThreshold, "Bad thresholds");
        BASE_THRESHOLD = _baseThreshold;
        MAX_THRESHOLD = _maxThreshold;
        TIME_TO_MAX_THRESHOLD = _timeToMaxThreshold;
        DRAW_COOLDOWN = _drawCooldown;
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
     * @notice Attempts to award the current prize pool to a random depositor using Chainlink VRF.
     * @dev Can be called by anyone at any time. The probability of payout increases with time
     *      elapsed since the last successful prize payout.
     */
    function awardPrize() external {
        require(depositors.length > 0, "No depositors");

        // Record the drawing attempt time irrespective of outcome.
        lastDrawingTimestamp = block.timestamp;

        // If no yield accrued, do not request VRF; leave lastWinner/lastPrizeAmount unchanged.
        if (prizePool() == 0) return;

        require(!vrfRequestPending, "VRF request pending");

        // Build a randomness request for 1 word, paid in LINK by default.
        VRFV2PlusClient.RandomWordsRequest memory req = VRFV2PlusClient.RandomWordsRequest({
            keyHash: VRF_KEY_HASH,
            subId: VRF_SUBSCRIPTION_ID,
            requestConfirmations: VRF_REQUEST_CONFIRMATIONS,
            callbackGasLimit: VRF_CALLBACK_GAS_LIMIT,
            numWords: 1,
            extraArgs: VRFV2PlusClient._argsToBytes(
                VRFV2PlusClient.ExtraArgsV1({nativePayment: false})
            )
        });

        uint256 requestId = s_vrfCoordinator.requestRandomWords(req);
        lastRequestId = requestId;
        vrfRequestPending = true;
    }

    //-//////////////////////////////////////////////////////////
    //                  INTERNAL HELPER FUNCTIONS
    //-//////////////////////////////////////////////////////////

    /**
     * @dev Chainlink VRF callback. Generates a d100 and awards prize if d100 < 10.
     *      Also uses the same random word to select a winner index.
     */
    function fulfillRandomWords(uint256 /*requestId*/, uint256[] calldata randomWords) internal override {
        vrfRequestPending = false;

        if (depositors.length == 0) {
            // Edge case: no depositors at fulfillment time
            return;
        }

        uint256 rand = randomWords[0];
        uint256 d100 = (rand % 100) + 1; // [1, 100]

        if (d100 < currentThreshold()) {
            uint256 prize = prizePool();
            if (prize == 0) {
                return;
            }

            // Select winner with probability proportional to their principal balance.
            // Use a weighted reservoir by drawing a ticket in [0, totalPrincipal-1] and
            // walking the cumulative balances until exceeding the ticket.
            uint256 ticket = rand % totalPrincipal;
            uint256 cumulative = 0;
            address winner = address(0);
            for (uint256 i = 0; i < depositors.length; i++) {
                cumulative += balanceOf[depositors[i]];
                if (cumulative > ticket) {
                    winner = depositors[i];
                    break;
                }
            }
            // Fallback (should not happen if totalPrincipal reflects sum of balances)
            if (winner == address(0)) {
                winner = depositors[depositors.length - 1];
            }

            // Credit the winner's principal balance with the prize, keeping assets in the vault
            balanceOf[winner] += prize;
            totalPrincipal += prize;

            lastWinner = winner;
            lastPrizeAmount = prize;
            lastPrizeTimestamp = block.timestamp;

            emit PrizeAwarded(winner, prize);
        }
    }

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

    /**
     * @notice Returns the current threshold used for d100 comparison (d100 < threshold wins).
     *         The threshold increases linearly from `baseThreshold` to `maxThreshold` over
     *         `timeToMaxThreshold` seconds since the last successful prize payout.
     */
    function currentThreshold() public view returns (uint256) {
        if (MAX_THRESHOLD == BASE_THRESHOLD) return uint256(MAX_THRESHOLD);

        // Progressive increase since last prize payout
        uint256 potential;
        if (TIME_TO_MAX_THRESHOLD == 0) {
            potential = uint256(MAX_THRESHOLD);
        } else {
            uint256 elapsedPrize = block.timestamp - lastPrizeTimestamp;
            uint256 increase = (uint256(MAX_THRESHOLD - BASE_THRESHOLD) * elapsedPrize) / TIME_TO_MAX_THRESHOLD;
            potential = uint256(BASE_THRESHOLD) + increase;
            if (potential > MAX_THRESHOLD) potential = MAX_THRESHOLD;
        }

        // Anti-spam damping since last drawing attempt
        if (DRAW_COOLDOWN == 0) return potential;
        uint256 elapsedDraw = block.timestamp - lastDrawingTimestamp;
        if (elapsedDraw >= DRAW_COOLDOWN) return potential;

        // Scale the incremental part by how much of the cooldown has elapsed
        uint256 scaledIncrease = ((potential - uint256(BASE_THRESHOLD)) * elapsedDraw) / DRAW_COOLDOWN;
        return uint256(BASE_THRESHOLD) + scaledIncrease;
    }
}
