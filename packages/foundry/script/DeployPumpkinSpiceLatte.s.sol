// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {PumpkinSpiceLatte} from "../src/PumpkinSpiceLatte.sol";
import {Morpho4626Adapter} from "../src/adapters/Morpho4626Adapter.sol";
import {KineticAdapter} from "../src/adapters/KineticAdapter.sol";
import {PseudoRandomAdapter} from "../src/adapters/PseudoRandomAdapter.sol";

contract DeployPumpkinSpiceLatte is Script {
	function run() external {
		// Config
		address vaultAddress = 0xd63070114470f685b75B74D60EEc7c1113d33a3D; // mainnet vault
		address kineticMarket = 0xC23B7fbE7CdAb4bf524b8eA72a7462c8879A99Ac; // KUSDCe
		uint256 roundDuration = 300; // 5 minutes

		uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
		vm.startBroadcast(deployerPrivateKey);

		address adapterAddress;
		// if (kineticMarket != address(0)) {
		if(vm.envUint("DEPLOY_KINETIC") == 1) {
			console.log("Deploying Kinetic Adapter");
			KineticAdapter kinetic = new KineticAdapter(kineticMarket);
			adapterAddress = address(kinetic);
		} else {
			console.log("Deploying Morpho Adapter");
			Morpho4626Adapter morpho = new Morpho4626Adapter(vaultAddress);
			adapterAddress = address(morpho);
		}
		PseudoRandomAdapter rng = new PseudoRandomAdapter();

		PumpkinSpiceLatte psl = new PumpkinSpiceLatte(
			adapterAddress,
			address(rng),
			roundDuration
		);

		vm.stopBroadcast();

		console.log("PumpkinSpiceLatte deployed:", address(psl));
		console.log("Adapter:", adapterAddress);
		console.log("RNG:", address(rng));
	}
}
