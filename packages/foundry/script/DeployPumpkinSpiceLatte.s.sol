// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {PumpkinSpiceLatte} from "../src/PumpkinSpiceLatte.sol";
import {Morpho4626Adapter} from "../src/adapters/Morpho4626Adapter.sol";
import {KineticAdapter} from "../src/adapters/KineticAdapter.sol";
import {PseudoRandomAdapter} from "../src/adapters/PseudoRandomAdapter.sol";
import {FlareSecureRandomAdapter} from "../src/adapters/FlareSecureRandomAdapter.sol";
import {KineticAdapter} from "../src/adapters/KineticAdapter.sol";
import {IERC4626Vault} from "../src/adapters/Morpho4626Adapter.sol";

contract DeployPumpkinSpiceLatte is Script {
	function run() external {
		// Config
		// Default mainnet vault; can be overridden via env var VAULT_ADDRESS for other networks (e.g. Katana)
		// address vaultAddress = 0xd63070114470f685b75B74D60EEc7c1113d33a3D; // default mainnet vault
		address vaultAddress = 0x61D4F9D3797BA4dA152238c53a6f93Fb665C3c1d; // Katana USDC vault
		address kineticMarket = 0xC23B7fbE7CdAb4bf524b8eA72a7462c8879A99Ac; // KUSDCe
		uint256 baseRewardHalfLife = 300; // 5 minutes
		uint256 halfLife2 = 300; // 5 minutes

		bool deployToFlare = vm.envBool("DEPLOY_FLARE");
		bool deployToKatana = vm.envBool("DEPLOY_KATANA");

		// // If running on Katana mainnet, select the provided Morpho USDC vault by default
		// if (deployToKatana) {
		// 	vaultAddress = 0x61D4F9D3797BA4dA152238c53a6f93Fb665C3c1d;
		// }
		address underlying = 0x203A662b0BD271A6ed5a60EdFbd04bFce608FD36; // Katana USDC

		uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
		vm.startBroadcast(deployerPrivateKey);

		address adapterAddress;

		if(deployToFlare) {
			console.log("Deploying Flare Adapter");
			KineticAdapter kinetic = new KineticAdapter(kineticMarket);
			adapterAddress = address(kinetic);
		} else {
			console.log("Deploying Morpho Adapter");
			console.log("Vault Address:", vaultAddress);
			// Determine underlying asset address (explicit on Katana)
			address underlying;
			// underlying = IERC4626Vault(vaultAddress).asset();
			// console.log("Vault ASSET:", underlying);
			Morpho4626Adapter morpho = new Morpho4626Adapter(vaultAddress, underlying);
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
			baseRewardHalfLife,
			halfLife2
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
