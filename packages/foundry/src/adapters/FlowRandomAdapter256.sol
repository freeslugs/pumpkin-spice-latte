// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IRandomnessProvider} from "../interfaces/IRandomnessProvider.sol";

/**
 * @title FlowRandomAdapter256
 * @notice Adapter for Flow network's Cadence Arch random number generation
 * @dev Implements IRandomnessProvider interface for use in the Pumpkin Spice Latte project
 * @dev Uses multiple calls to Cadence Arch for maximum entropy (~256 bits)
 * @dev Uses Cadence Arch contract at 0x0000000000000000000000010000000000000001
 */
contract FlowRandomAdapter256 is IRandomnessProvider {
    // Address of the Cadence Arch contract on Flow EVM
    address public constant CADENCE_ARCH = 0x0000000000000000000000010000000000000001;

    /**
     * @notice Generates a secure random uint256 using Flow's Cadence Arch
     * @param salt Additional entropy to mix with the random number
     * @return A secure random uint256 value with maximum entropy
     * @dev Makes 4 calls to Cadence Arch to achieve ~256 bits of entropy
     * @dev Combines with block context and salt for additional randomness
     * @dev Implements IRandomnessProvider interface with high-quality randomness
     */
    function randomUint256(bytes32 salt) external view returns (uint256) {
        // Get multiple random numbers from Cadence Arch to increase entropy
        uint64 random1 = _getRevertibleRandom();
        uint64 random2 = _getRevertibleRandom();
        uint64 random3 = _getRevertibleRandom();
        uint64 random4 = _getRevertibleRandom();

        // Combine multiple random numbers with salt and block context for maximum entropy
        // This approach provides ~256 bits of entropy (4 * 64 bits) plus additional sources
        return uint256(
            keccak256(abi.encodePacked(random1, random2, random3, random4, salt, block.timestamp, block.prevrandao))
        );
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
