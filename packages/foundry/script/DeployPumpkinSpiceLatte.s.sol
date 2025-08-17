// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {PumpkinSpiceLatte} from "../src/PumpkinSpiceLatte.sol";
import {Morpho4626Adapter} from "../src/adapters/Morpho4626Adapter.sol";
import {KineticAdapter} from "../src/adapters/KineticAdapter.sol";
import {PseudoRandomAdapter} from "../src/adapters/PseudoRandomAdapter.sol";
import {MoreMarketsAdapter} from "../src/adapters/MoreMarketsAdapter.sol";
import {FlareSecureRandomAdapter} from "../src/adapters/FlareSecureRandomAdapter.sol";
import {KineticAdapter} from "../src/adapters/KineticAdapter.sol";

contract DeployPumpkinSpiceLatte is Script {
	function run() external {
		// Config
		address vaultAddress = 0xd63070114470f685b75B74D60EEc7c1113d33a3D; // default: ERC4626 vault (override with VAULT_ADDRESS)
		uint256 roundDuration = 300; // 5 minutes

		bool deployToFlare = vm.envBool("DEPLOY_FLARE");

		uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
		vm.startBroadcast(deployerPrivateKey);

		address adapterAddress;
		if(deployToFlare) {
			console.log("Deploying Kinetic Adapter");
			address kineticMarket = vm.envAddress("KINETIC_MARKET");
			KineticAdapter kinetic = new KineticAdapter(kineticMarket);
			adapterAddress = address(kinetic);
		} else if (vm.envUint("DEPLOY_MORE") == 1) {
			address moreMarket = vm.envAddress("MORE_MARKET");
			require(moreMarket != address(0), "MORE_MARKET required");
			console.log("Deploying More Markets Adapter");
			MoreMarketsAdapter more = new MoreMarketsAdapter(moreMarket);
			adapterAddress = address(more);
		} else {
			console.log("Deploying Morpho Adapter");
			address vault = vm.envOr("VAULT_ADDRESS", vaultAddress);
			Morpho4626Adapter morpho = new Morpho4626Adapter(vault);
			adapterAddress = address(morpho);
		}

		// Deploy the appropriate random number provider
		address rngAddress;
		string memory rngType;
		
		if (deployToFlare) {
			FlareSecureRandomAdapter flareRng = new FlareSecureRandomAdapter();
			rngAddress = address(flareRng);
			rngType = "FlareSecureRandomAdapter (Secure VRF)";
			
			// Log Flare contract addresses for verification
			console.log("\n=== Flare Contract Addresses ===");
			console.log("FlareSecureRandomAdapter:", address(flareRng));
			console.log("Random Number Contract:", flareRng.getRandomNumberContract());
			console.log("Note: Contract addresses are fetched from Flare's ContractRegistry");
			console.log("For mainnet, verify these addresses match the target network");
		} else {
			PseudoRandomAdapter pseudoRng = new PseudoRandomAdapter();
			rngAddress = address(pseudoRng);
			rngType = "PseudoRandomAdapter (devnet only)";
		}

		PumpkinSpiceLatte psl = new PumpkinSpiceLatte(
			adapterAddress,
			rngAddress,
			roundDuration
		);

		vm.stopBroadcast();

		console.log("=== Deployment Complete ===");
		console.log("PumpkinSpiceLatte deployed:", address(psl));
		console.log("Kinetic or Morpho4626Adapter:", adapterAddress);
		console.log("Random Number Provider:", rngType); // FlareSecureRandomAdapter (Secure VRF) or PseudoRandomAdapter (devnet only)
		console.log("RNG Address:", rngAddress);
		
		if (deployToFlare) {
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
		console.log("Kinetic or Morpho4626Adapter:", adapterAddress);
		console.log("RNG:", rngAddress);
	}
}
