// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {PumpkinSpiceLatte} from "../src/PumpkinSpiceLatte.sol";
import {Morpho4626Adapter} from "../src/adapters/Morpho4626Adapter.sol";
import {KineticAdapter} from "../src/adapters/KineticAdapter.sol";
import {PseudoRandomAdapter} from "../src/adapters/PseudoRandomAdapter.sol";
import {MoreMarketsAdapter} from "../src/adapters/MoreMarketsAdapter.sol";

contract DeployPumpkinSpiceLatte is Script {
	function run() external {
		// Config
		address vaultAddress = 0xd63070114470f685b75B74D60EEc7c1113d33a3D; // default: ERC4626 vault (override with VAULT_ADDRESS)
		uint256 roundDuration = 300; // 5 minutes

		uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
		vm.startBroadcast(deployerPrivateKey);

		address adapterAddress;
		// Select adapter via env flags
		if(vm.envUint("DEPLOY_KINETIC") == 1) {
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
