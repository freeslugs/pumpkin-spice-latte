// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IRandomnessProvider} from "../interfaces/IRandomnessProvider.sol";
import {VRFConsumerBaseV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";

/**
 * @title ChainlinkVRFAdapter
 * @dev Adapter that sources randomness from Chainlink VRF v2.5 and exposes a simple
 *      synchronous interface compatible with `IRandomnessProvider`.
 *      Consumers can read a deterministic random value derived from the latest fulfilled
 *      VRF random word combined with a caller-provided salt.
 *
 *      Note: This contract requires someone to call `requestRandomness()` periodically
 *      so that `latestRandomWord` is refreshed. Consumers are expected to handle the case
 *      where no randomness has been fulfilled yet.
 */
contract ChainlinkVRFAdapter is IRandomnessProvider, VRFConsumerBaseV2Plus {
    //-//////////////////////////////////////////////////////////
    //                           STATE
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

    /// @dev Whether to pay in native token. Default false (pay in LINK).
    bool public immutable VRF_NATIVE_PAYMENT;

    /// @dev Stores the latest random word returned by VRF.
    uint256 public latestRandomWord;

    /// @dev Tracks whether at least one fulfillment has occurred.
    bool public hasRandomness;

    /// @dev Last VRF request id issued by this adapter.
    uint256 public lastRequestId;

    //-//////////////////////////////////////////////////////////
    //                           EVENTS
    //-//////////////////////////////////////////////////////////

    event RandomnessRequested(uint256 indexed requestId);
    event RandomnessFulfilled(uint256 indexed requestId, uint256 randomWord);

    //-//////////////////////////////////////////////////////////
    //                         CONSTRUCTOR
    //-//////////////////////////////////////////////////////////

    constructor(
        address _vrfCoordinator,
        bytes32 _vrfKeyHash,
        uint256 _vrfSubscriptionId,
        uint32 _vrfCallbackGasLimit,
        uint16 _vrfRequestConfirmations,
        bool _nativePayment
    ) VRFConsumerBaseV2Plus(_vrfCoordinator) {
        VRF_COORDINATOR = _vrfCoordinator;
        VRF_KEY_HASH = _vrfKeyHash;
        VRF_SUBSCRIPTION_ID = _vrfSubscriptionId;
        VRF_CALLBACK_GAS_LIMIT = _vrfCallbackGasLimit;
        VRF_REQUEST_CONFIRMATIONS = _vrfRequestConfirmations;
        VRF_NATIVE_PAYMENT = _nativePayment;
    }

    //-//////////////////////////////////////////////////////////
    //                    IRandomnessProvider VIEW
    //-//////////////////////////////////////////////////////////

    function randomUint256(bytes32 salt) external view returns (uint256) {
        require(hasRandomness, "VRF: no randomness yet");
        return uint256(keccak256(abi.encodePacked(latestRandomWord, salt)));
    }

    //-//////////////////////////////////////////////////////////
    //                         VRF REQUEST/CB
    //-//////////////////////////////////////////////////////////

    function requestRandomness() external returns (uint256 requestId) {
        VRFV2PlusClient.RandomWordsRequest memory req = VRFV2PlusClient.RandomWordsRequest({
            keyHash: VRF_KEY_HASH,
            subId: VRF_SUBSCRIPTION_ID,
            requestConfirmations: VRF_REQUEST_CONFIRMATIONS,
            callbackGasLimit: VRF_CALLBACK_GAS_LIMIT,
            numWords: 1,
            extraArgs: VRFV2PlusClient._argsToBytes(
                VRFV2PlusClient.ExtraArgsV1({nativePayment: VRF_NATIVE_PAYMENT})
            )
        });

        requestId = s_vrfCoordinator.requestRandomWords(req);
        lastRequestId = requestId;
        emit RandomnessRequested(requestId);
    }

    function fulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) internal override {
        uint256 word = randomWords[0];
        latestRandomWord = word;
        hasRandomness = true;
        emit RandomnessFulfilled(requestId, word);
    }
}


