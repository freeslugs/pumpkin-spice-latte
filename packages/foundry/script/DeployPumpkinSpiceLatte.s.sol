// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {PumpkinSpiceLatte} from "../src/PumpkinSpiceLatte.sol";

contract DeployPumpkinSpiceLatte is Script {
    function run() external {
        // Sepolia Configuration
        // Underlying asset: USDC on Sepolia
        address usdcAddress = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
        // address usdcAddress = 0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8;
        // Morpho Blue Vault on Sepolia (USDC-based)
        // address vaultAddress = 0x1Ae025197a765bD2263d6eb89B76d82e05286543; //sepolia 
        address vaultAddress = 0xd63070114470f685b75B74D60EEc7c1113d33a3D; // ethereum

        // Chainlink VRF params (provide via env for network):
        // VRF_COORDINATOR, VRF_KEY_HASH, VRF_SUBSCRIPTION_ID, VRF_CALLBACK_GAS_LIMIT, VRF_REQUEST_CONFIRMATIONS
        address vrfCoordinator = vm.envAddress("VRF_COORDINATOR");
        bytes32 vrfKeyHash = vm.envBytes32("VRF_KEY_HASH");
        uint256 vrfSubId = vm.envUint("VRF_SUBSCRIPTION_ID");
        uint32 vrfCallbackGasLimit = uint32(vm.envUint("VRF_CALLBACK_GAS_LIMIT"));
        uint16 vrfRequestConfs = uint16(vm.envUint("VRF_REQUEST_CONFIRMATIONS"));

        // Prize policy params (also from env):
        // BASE_THRESHOLD, MAX_THRESHOLD, TIME_TO_MAX_THRESHOLD, DRAW_COOLDOWN
        uint8 baseThreshold = uint8(vm.envUint("BASE_THRESHOLD"));
        uint8 maxThreshold = uint8(vm.envUint("MAX_THRESHOLD"));
        uint256 timeToMaxThreshold = vm.envUint("TIME_TO_MAX_THRESHOLD");
        uint256 drawCooldown = vm.envUint("DRAW_COOLDOWN");

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        PumpkinSpiceLatte psl = new PumpkinSpiceLatte(
            usdcAddress,
            vaultAddress,
            vrfCoordinator,
            vrfKeyHash,
            vrfSubId,
            vrfCallbackGasLimit,
            vrfRequestConfs,
            baseThreshold,
            maxThreshold,
            timeToMaxThreshold,
            drawCooldown
        );

        vm.stopBroadcast();

        address contractAddress = address(psl);
        console.log("PumpkinSpiceLatte contract deployed to:", contractAddress);
    }
}
