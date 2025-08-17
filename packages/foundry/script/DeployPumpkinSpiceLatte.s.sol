// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {PumpkinSpiceLatte} from "../src/PumpkinSpiceLatte.sol";
import {Morpho4626Adapter} from "../src/adapters/Morpho4626Adapter.sol";
import {PseudoRandomAdapter} from "../src/adapters/PseudoRandomAdapter.sol";
import {FlareSecureRandomAdapter} from "../src/adapters/FlareSecureRandomAdapter.sol";

contract DeployPumpkinSpiceLatte is Script {
	function run() external {
		// Config
		address vaultAddress = 0xd63070114470f685b75B74D60EEc7c1113d33a3D; // mainnet vault
		uint256 roundDuration = 300; // 5 minutes

		// Choose your random number provider:
		// - PseudoRandomAdapter: For testing/development (predictable, works on any network)
		// - FlareSecureRandomAdapter: For production on Flare Network (secure, cryptographic)
		bool useFlareRandom = vm.envBool("USE_FLARE_RANDOM"); // Set to true to use Flare adapter

		uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
		vm.startBroadcast(deployerPrivateKey);

		Morpho4626Adapter adapter = new Morpho4626Adapter(vaultAddress);
		
		// Deploy the appropriate random number provider
		address rngAddress;
		string memory rngType;
		
		if (useFlareRandom) {
			FlareSecureRandomAdapter flareRng = new FlareSecureRandomAdapter();
			rngAddress = address(flareRng);
			rngType = "FlareSecureRandomAdapter (Secure VRF)";
		} else {
			PseudoRandomAdapter pseudoRng = new PseudoRandomAdapter();
			rngAddress = address(pseudoRng);
			rngType = "PseudoRandomAdapter (Testing only)";
		}

		PumpkinSpiceLatte psl = new PumpkinSpiceLatte(
			address(adapter),
			rngAddress,
			roundDuration
		);

		vm.stopBroadcast();

		console.log("=== Deployment Complete ===");
		console.log("PumpkinSpiceLatte deployed:", address(psl));
		console.log("Morpho4626Adapter:", address(adapter));
		console.log("Random Number Provider:", rngType);
		console.log("RNG Address:", rngAddress);
		
		if (useFlareRandom) {
			console.log("\n=== Flare Network Info ===");
			console.log("Network: Flare (Coston2/Mainnet)");
			console.log("Randomness: Secure VRF from Flare network");
			console.log("Note: This adapter only works on Flare Network");
		} else {
			console.log("\n=== Development Info ===");
			console.log("Network: Any EVM compatible");
			console.log("Randomness: Pseudo-random (predictable)");
			console.log("Warning: Not suitable for production use");
		}
	}
}
