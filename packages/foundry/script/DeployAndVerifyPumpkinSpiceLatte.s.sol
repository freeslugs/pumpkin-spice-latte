// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {PumpkinSpiceLatte} from "../src/PumpkinSpiceLatte.sol";

contract DeployAndVerifyPumpkinSpiceLatte is Script {
    function run() external {
        // Sepolia Configuration
        address wethAddress = 0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9;
        address morphoAddress = 0xd011EE229E7459ba1ddd22631eF7bF528d424A14;
        bytes32 marketId = 0x1Ae025197a765bD2263d6eb89B76d82e05286543; // this is a vault
        uint256 roundDuration = 86400; // 1 day

        console.log(" Starting PumpkinSpiceLatte deployment and verification...");
        console.log("");
        
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
        console.log(" PumpkinSpiceLatte contract deployed to:", contractAddress);
        
        // Get constructor arguments for verification
        bytes memory constructorArgs = abi.encode(
            wethAddress,
            morphoAddress,
            marketId,
            roundDuration
        );
        
        // console.log("");
        // console.log(" Contract Configuration:");
        // console.log("  WETH Address:", wethAddress);
        // console.log("  Morpho Address:", morphoAddress);
        // console.log("  Market ID:", vm.toString(marketId));
        // console.log("  Round Duration:", roundDuration, "seconds (", roundDuration / 86400, "days)");
        // console.log("");
        // console.log(" Constructor Arguments (encoded):");
        // console.log(vm.toString(constructorArgs));
        // console.log("");
        
        // // Display verification commands
        // console.log(" Verification Commands:");
        // console.log("");
        // console.log("Option 1 - Using Foundry (recommended):");
        // console.log("forge verify-contract", contractAddress, "src/PumpkinSpiceLatte.sol:PumpkinSpiceLatte", "--chain-id 11155111", "--constructor-args", vm.toString(constructorArgs));
        // console.log("");
        // console.log("Option 2 - With explicit Etherscan API key:");
        // console.log("ETHERSCAN_API_KEY=your_key forge verify-contract", contractAddress, "src/PumpkinSpiceLatte.sol:PumpkinSpiceLatte", "--chain-id 11155111", "--constructor-args", vm.toString(constructorArgs));
        // console.log("");
        // console.log("Option 3 - Using environment variable:");
        // console.log("forge verify-contract", contractAddress, "src/PumpkinSpiceLatte.sol:PumpkinSpiceLatte", "--chain-id 11155111", "--constructor-args", vm.toString(constructorArgs), "--etherscan-api-key $ETHERSCAN_API_KEY");
        // console.log("");
        // console.log(" View your contract on Etherscan:");
        // console.log("https://sepolia.etherscan.io/address/", contractAddress);
        // console.log("");
        // console.log(" Make sure you have set the ETHERSCAN_API_KEY environment variable!");
        // console.log("");
        // console.log(" Deployment complete! Copy one of the verification commands above to verify your contract.");
        // console.log("");
        // console.log(" Quick verification (if you have ETHERSCAN_API_KEY set):");
        // console.log("forge verify-contract", contractAddress, "src/PumpkinSpiceLatte.sol:PumpkinSpiceLatte", "--chain-id 11155111", "--constructor-args", vm.toString(constructorArgs), "--etherscan-api-key $ETHERSCAN_API_KEY");
    }
}
