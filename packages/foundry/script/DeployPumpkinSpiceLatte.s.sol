// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {PumpkinSpiceLatte} from "../src/PumpkinSpiceLatte.sol";
import {Morpho4626Adapter} from "../src/adapters/Morpho4626Adapter.sol";
import {PseudoRandomAdapter} from "../src/adapters/PseudoRandomAdapter.sol";

contract DeployPumpkinSpiceLatte is Script {
	function run() external {
		// Config
		address vaultAddress = 0xd63070114470f685b75B74D60EEc7c1113d33a3D; // mainnet vault
		uint256 roundDuration = 300; // 5 minutes

		uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
		vm.startBroadcast(deployerPrivateKey);

		Morpho4626Adapter adapter = new Morpho4626Adapter(vaultAddress);
		PseudoRandomAdapter rng = new PseudoRandomAdapter();

		PumpkinSpiceLatte psl = new PumpkinSpiceLatte(
			address(adapter),
			address(rng),
			roundDuration
		);

		vm.stopBroadcast();

		console.log("PumpkinSpiceLatte deployed:", address(psl));
		console.log("Adapter:", address(adapter));
		console.log("RNG:", address(rng));
	}
}
