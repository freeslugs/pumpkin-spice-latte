// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IRandomnessProvider} from "../interfaces/IRandomnessProvider.sol";

/**
 * @title FlowRandomAdapter64
 * @notice Adapter for Flow network's Cadence Arch random number generation
 * @dev Implements IRandomnessProvider interface for random number generation
 * @dev Uses single call to Cadence Arch for 64 bits of entropy
 * @dev Suitable for applications where gas cost is more important than maximum randomness
 * @dev Uses Cadence Arch contract at 0x0000000000000000000000010000000000000001
 */
contract FlowRandomAdapter64 is IRandomnessProvider {
    // Address of the Cadence Arch contract on Flow EVM
    address public constant CADENCE_ARCH = 0x0000000000000000000000010000000000000001;

    /**
     * @notice Generates a random uint256 using Flow's Cadence Arch (gas efficient)
     * @param salt Additional entropy to mix with the random number
     * @return A random uint256 value with 64 bits of entropy
     * @dev Single call to Cadence Arch for gas efficiency
     * @dev Combines with block context and salt for additional randomness
     * @dev Implements IRandomnessProvider interface
     */
    function randomUint256(bytes32 salt) external view returns (uint256) {
        // Get single random number from Cadence Arch for gas efficiency
        uint64 randomNumber = _getRevertibleRandom();

        // Mix the random number with salt and block context
        // Note: This provides 64 bits of entropy from Cadence Arch
        return uint256(keccak256(abi.encodePacked(randomNumber, salt, block.timestamp)));
    }

    /**
     * @notice Get the raw secure random number from Cadence Arch
     * @return randomNumber The secure random number
     * @dev Uses revertibleRandom() which is safe but allows transaction reverts
     */
    function getSecureRandomNumber() external view returns (uint64 randomNumber) {
        return _getRevertibleRandom();
    }

    /**
     * @notice Get the address of the Cadence Arch contract
     * @return The address of the Cadence Arch contract
     */
    function getCadenceArchAddress() external pure returns (address) {
        return CADENCE_ARCH;
    }

    /**
     * @notice Internal function to call Cadence Arch's revertibleRandom()
     * @return The secure random number from Cadence Arch
     * @dev This function can revert if the random outcome is unfavorable
     */
    function _getRevertibleRandom() internal view returns (uint64) {
        // Static call to the Cadence Arch contract's revertibleRandom function
        (bool ok, bytes memory data) = CADENCE_ARCH.staticcall(abi.encodeWithSignature("revertibleRandom()"));

        require(ok, "Failed to fetch random number from Cadence Arch");

        uint64 output = abi.decode(data, (uint64));
        return output;
    }
}
