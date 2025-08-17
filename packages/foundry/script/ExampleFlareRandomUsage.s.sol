// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {FlareSecureRandomAdapter} from "../src/adapters/FlareSecureRandomAdapter.sol";

/**
 * @title ExampleFlareRandomUsage
 * @notice Example script demonstrating practical usage of FlareSecureRandomAdapter
 * @dev This script shows various ways to use the secure random number generator
 */
contract ExampleFlareRandomUsage is Script {
    function run() external {
        console.log("=== FlareSecureRandomAdapter Usage Examples ===");
        
        // Note: This script is for demonstration purposes
        // In practice, you would deploy this on Flare Network
        
        console.log("\n1. Basic Random Number Generation");
        console.log("   - Use randomUint256(salt) for secure randomness");
        console.log("   - Salt provides additional entropy and prevents replay");
        
        console.log("\n2. Lottery/Game Applications");
        console.log("   - Generate winner indices: randomNumber % participants.length");
        console.log("   - Create unique game IDs with timestamps");
        console.log("   - Shuffle arrays or select random elements");
        
        console.log("\n3. NFT/Token Applications");
        console.log("   - Random trait generation");
        console.log("   - Random minting order");
        console.log("   - Random distribution algorithms");
        
        console.log("\n4. DeFi Applications");
        console.log("   - Random reward distribution");
        console.log("   - Random selection for airdrops");
        console.log("   - Random parameter variations");
        
        console.log("\n=== Code Examples ===");
        
        console.log("\n// Basic random number generation");
        console.log("bytes32 salt = keccak256(abi.encodePacked(msg.sender, block.timestamp));");
        console.log("uint256 randomValue = flareRng.randomUint256(salt);");
        
        console.log("\n// Lottery winner selection");
        console.log("uint256 winnerIndex = randomValue % participants.length;");
        console.log("address winner = participants[winnerIndex];");
        
        console.log("\n// Random trait generation");
        console.log("uint256 traitId = randomValue % totalTraits;");
        console.log("string memory trait = traitNames[traitId];");
        
        console.log("\n// Random array shuffling");
        console.log("for (uint i = 0; i < array.length; i++) {");
        console.log("    uint256 j = randomValue % array.length;");
        console.log("    // swap array[i] and array[j]");
        console.log("}");
        
        console.log("\n=== Security Best Practices ===");
        console.log("1. Always use unique salts for each random number request");
        console.log("2. Never reuse random numbers for different purposes");
        console.log("3. The adapter automatically validates random number security");
        console.log("4. Consider implementing fallback mechanisms for network issues");
        console.log("5. Test thoroughly on Flare testnet before mainnet deployment");
        
        console.log("\n=== Network Requirements ===");
        console.log("- Deploy on Flare Network (Coston2 testnet or mainnet)");
        console.log("- Ensure @flarenetwork/flare-periphery-contracts dependency");
        console.log("- Random numbers are generated every 90 seconds");
        console.log("- Gas costs are higher than pseudo-random alternatives");
        
        console.log("\n=== Integration Steps ===");
        console.log("1. Deploy FlareSecureRandomAdapter");
        console.log("2. Pass adapter address to PumpkinSpiceLatte constructor");
        console.log("3. Use randomUint256(salt) instead of other random sources");
        console.log("4. Handle potential network-specific errors gracefully");
    }
}
