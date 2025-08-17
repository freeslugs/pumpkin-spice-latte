// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {PumpkinSpiceLatte} from "../src/PumpkinSpiceLatte.sol";
import {Morpho4626Adapter} from "../src/adapters/Morpho4626Adapter.sol";
import {KineticAdapter} from "../src/adapters/KineticAdapter.sol";
import {PseudoRandomAdapter} from "../src/adapters/PseudoRandomAdapter.sol";
import {MoreMarketsAdapter} from "../src/adapters/MoreMarketsAdapter.sol";
import {FlareSecureRandomAdapter} from "../src/adapters/FlareSecureRandomAdapter.sol";
import {FlowRandomAdapter256} from "../src/adapters/FlowRandomAdapter256.sol";
import {FlowRandomAdapter64} from "../src/adapters/FlowRandomAdapter64.sol";

contract DeployPumpkinSpiceLatte is Script {
	function run() external {
		// Config
		address vaultAddress = 0xd63070114470f685b75B74D60EEc7c1113d33a3D; // mainnet vault
		address kineticMarket = 0xC23B7fbE7CdAb4bf524b8eA72a7462c8879A99Ac; // KUSDCe
		uint256 baseRewardHalfLife = 3600; // 1 hour
		uint256 halfLife2 = 3600; // every hour since last winner, halve the half-life

		bool deployToFlare = vm.envBool("DEPLOY_FLARE");
		bool deployToFlow = vm.envBool("DEPLOY_FLOW");
		bool useFlow64 = vm.envBool("FLOW_64");

		// Use the private key from the broadcast context instead of environment variable
		vm.startBroadcast();

		address adapterAddress;
		if(deployToFlare) {
			console.log("Deploying Kinetic Adapter");
			address kineticMarketAddress = vm.envAddress("KINETIC_MARKET");
			KineticAdapter kinetic = new KineticAdapter(kineticMarketAddress);
			adapterAddress = address(kinetic);
		} else if (deployToFlow) {
			console.log("Deploying Flow with Lending Adapter");
			// For Flow, we can use any lending adapter (MoreMarkets, Morpho, etc.)
			// The randomness is handled by the FlowRandomAdapter
			if (vm.envUint("DEPLOY_MORE") == 1) {
				address moreMarket = vm.envAddress("MORE_MARKET");
				require(moreMarket != address(0), "MORE_MARKET required");
				console.log("Deploying More Markets Adapter for Flow");
				MoreMarketsAdapter more = new MoreMarketsAdapter(moreMarket);
				adapterAddress = address(more);
			} else {
				// Default to Morpho for Flow if no specific adapter specified
				address vault = vm.envOr("VAULT_ADDRESS", vaultAddress);
				console.log("Deploying Morpho Adapter for Flow");
				Morpho4626Adapter morpho = new Morpho4626Adapter(vault);
				adapterAddress = address(morpho);
			}
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
		} else if (deployToFlow) {
			address flowRngAddress;
			string memory flowRngType;
			
			if (useFlow64) {
				FlowRandomAdapter64 flowRng = new FlowRandomAdapter64();
				flowRngAddress = address(flowRng);
				flowRngType = "FlowRandomAdapter64 (64 bits)";
			} else {
				FlowRandomAdapter256 flowRng = new FlowRandomAdapter256();
				flowRngAddress = address(flowRng);
				flowRngType = "FlowRandomAdapter256 (256 bits)";
			}
			
			rngAddress = flowRngAddress;
			rngType = flowRngType;
			
			// Log Flow contract addresses for verification
			console.log("\n=== Flow Contract Addresses ===");
			console.log("Flow Random Adapter:", flowRngAddress);
			console.log("Adapter Type:", flowRngType);
			console.log("Cadence Arch Address:", 0x0000000000000000000000010000000000000001);
			console.log("Note: Uses Cadence Arch at 0x0000000000000000000000010000000000000001");
			console.log("For mainnet, verify this address matches the target Flow network");
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
		console.log("Lending Adapter:", adapterAddress);
		console.log("Random Number Provider:", rngType);
		console.log("RNG Address:", rngAddress);
		console.log("Base Reward Half-Life:", baseRewardHalfLife);
		console.log("Half-Life 2:", halfLife2);
		
		if (deployToFlare) {
			console.log("\n=== Flare Network Info ===");
			console.log("Network: Flare (Coston2/Mainnet)");
			console.log("Randomness: Secure VRF from Flare network");
			console.log("Note: This adapter only works on Flare Network");
		} else if (deployToFlow) {
			console.log("\n=== Flow Network Info ===");
			console.log("Network: Flow EVM");
			if (useFlow64) {
				console.log("Randomness: 64 bits from Cadence Arch");
			} else {
				console.log("Randomness: 256 bits from Cadence Arch");
			}
			console.log("Note: This adapter only works on Flow Network");
		} else {
			console.log("\n=== Development Info ===");
			console.log("Network: Any EVM compatible");
			console.log("Randomness: Pseudo-random (predictable)");
			console.log("Warning: Not suitable for production use");
		}
		console.log("Lending Adapter:", adapterAddress);
		console.log("RNG:", rngAddress);
	}
}
