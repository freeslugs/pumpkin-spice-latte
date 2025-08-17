// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {PumpkinSpiceLatte} from "../src/PumpkinSpiceLatte.sol";
import {Morpho4626Adapter} from "../src/adapters/Morpho4626Adapter.sol";
import {FlareSecureRandomAdapter} from "../src/adapters/FlareSecureRandomAdapter.sol";

/**
 * @title DeployWithFlareRandom
 * @notice Deployment script using Flare's secure random number generation
 * @dev This script demonstrates how to deploy PumpkinSpiceLatte with FlareSecureRandomAdapter
 *      instead of the PseudoRandomAdapter for production use
 */
contract DeployWithFlareRandom is Script {
    function run() external {
        // Config
        address vaultAddress = 0xd63070114470f685b75B74D60EEc7c1113d33a3D; // mainnet vault
        uint256 roundDuration = 300; // 5 minutes

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // Deploy the lending adapter
        Morpho4626Adapter adapter = new Morpho4626Adapter(vaultAddress);
        
        // Deploy Flare's secure random number adapter
        // Note: This will only work on Flare network (Coston2 testnet or mainnet)
        FlareSecureRandomAdapter flareRng = new FlareSecureRandomAdapter();

        // Deploy PumpkinSpiceLatte with the secure random number generator
        PumpkinSpiceLatte psl = new PumpkinSpiceLatte(
            address(adapter),
            address(flareRng),
            roundDuration
        );

        vm.stopBroadcast();

        console.log("=== Deployment Complete ===");
        console.log("PumpkinSpiceLatte deployed:", address(psl));
        console.log("Morpho4626Adapter:", address(adapter));
        console.log("FlareSecureRandomAdapter:", address(flareRng));
        console.log("Network: Flare (Coston2/Mainnet)");
        console.log("Randomness: Secure VRF from Flare network");
        console.log("Round Duration:", roundDuration, "seconds");
        
        // Additional information about the Flare adapter
        console.log("\n=== Flare Random Number Info ===");
        console.log("Random Number Contract:", flareRng.getRandomNumberContract());
        (uint256 randomNumber, bool isSecure, uint256 timestamp) = flareRng.getSecureRandomNumber();
        console.log("Current Random Number:", randomNumber);
        console.log("Is Secure:", isSecure);
        console.log("Generated At:", timestamp);
    }
}
