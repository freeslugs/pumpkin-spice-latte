// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {PumpkinSpiceLatte} from "../src/PumpkinSpiceLatte.sol";

contract DeployPumpkinSpiceLatte is Script {
    function run() external {
        // Sepolia Configuration
        address wethAddress = 0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9;
        address morphoAddress = 0xd011EE229E7459ba1ddd22631eF7bF528d424A14;
        bytes32 marketId = 0x1Ae025197a765bD2263d6eb89B76d82e05286543000000000000000000000000;
        uint256 roundDuration = 86400; // 1 day

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        PumpkinSpiceLatte psl = new PumpkinSpiceLatte(
            wethAddress,
            morphoAddress,
            marketId,
            roundDuration
        );

        vm.stopBroadcast();

        address contractAddress = address(psl);
        console.log("PumpkinSpiceLatte contract deployed to:", contractAddress);
    }
}
