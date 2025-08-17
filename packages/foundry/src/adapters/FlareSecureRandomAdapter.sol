// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IRandomnessProvider} from "../interfaces/IRandomnessProvider.sol";
import {ContractRegistry} from "@flarenetwork/flare-periphery-contracts/coston2/ContractRegistry.sol";
import {RandomNumberV2Interface} from "@flarenetwork/flare-periphery-contracts/coston2/RandomNumberV2Interface.sol";

/**
 * @title FlareSecureRandomAdapter
 * @notice Adapter for Flare network's secure random number generation
 * @dev Implements IRandomnessProvider interface for use in the Pumpkin Spice Latte project
 */
contract FlareSecureRandomAdapter is IRandomnessProvider {
    RandomNumberV2Interface internal randomV2;

    /*
     * Initializes the adapter with Flare's RandomNumberV2Interface.
     * This adapter automatically fetches Flare contract addresses from ContractRegistry.getRandomNumberV2().
     * Contract addresses are hardcoded in the @flarenetwork/flare-periphery-contracts npm package for Coston2.
     * Separate this out properly or change the address for mainnet deployment.
     */
    constructor() {
        randomV2 = ContractRegistry.getRandomNumberV2();
    }

    /**
     * @notice Generates a secure random uint256 using Flare's VRF
     * @param salt Additional entropy to mix with the random number
     * @return A secure random uint256 value
     * @dev The salt parameter is mixed with the secure random number for additional entropy
     */
    function randomUint256(bytes32 salt) external view returns (uint256) {
        // Get the current random number and its properties
        (uint256 randomNumber, bool isSecureRandom, uint256 randomTimestamp) = randomV2.getRandomNumber();

        // Ensure the random number is secure before using it
        require(isSecureRandom, "Random number is not secure");

        // Mix the secure random number with the salt for additional entropy
        // This prevents the same random number from being used multiple times
        return uint256(keccak256(abi.encodePacked(randomNumber, salt)));
    }

    /**
     * @notice Get the raw secure random number from Flare
     * @return randomNumber The secure random number
     * @return isSecure Whether the random number is secure
     * @return timestamp When the random number was generated
     */
    function getSecureRandomNumber() external view returns (uint256 randomNumber, bool isSecure, uint256 timestamp) {
        (randomNumber, isSecure, timestamp) = randomV2.getRandomNumber();
        require(isSecure, "Random number is not secure");
        return (randomNumber, isSecure, timestamp);
    }

    /**
     * @notice Get the address of the Flare RandomNumberV2 contract
     * @return The address of the random number generator
     */
    function getRandomNumberContract() external view returns (address) {
        return address(randomV2);
    }
}
