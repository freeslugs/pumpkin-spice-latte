// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {HookMiner} from "@uniswap/v4-periphery/src/utils/HookMiner.sol";
import {BaseScript} from "./base/BaseScript.sol";
import {PumpkinSpiceLatteV4Hook} from "../src/PumpkinSpiceLatteV4Hook.sol";

/// @notice Mines the address and deploys the PumpkinSpiceLatteV4Hook contract
contract DeployPumpkinSpiceLatteV4Hook is BaseScript {
    function run() public {
        // Configuration
        // USDC on mainnet
        address usdcAddress = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;

        // Morpho Blue Vault on mainnet (USDC-based) - replace with actual vault address
        address vaultAddress = 0xd63070114470f685b75B74D60EEc7c1113d33a3D;

        uint256 roundDuration = 86400; // 1 day
        uint256 liquidityProviderBonusBps = 2000; // 20% bonus for LPs

        // Hook contracts must have specific flags encoded in the address
        uint160 flags = uint160(
            Hooks.BEFORE_ADD_LIQUIDITY_FLAG | Hooks.AFTER_ADD_LIQUIDITY_FLAG | Hooks.BEFORE_REMOVE_LIQUIDITY_FLAG
                | Hooks.AFTER_REMOVE_LIQUIDITY_FLAG | Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG
        );

        // Mine a salt that will produce a hook address with the correct flags
        bytes memory constructorArgs =
            abi.encode(poolManager, usdcAddress, vaultAddress, roundDuration, liquidityProviderBonusBps);
        (address hookAddress, bytes32 salt) = HookMiner.find(
            address(0x4e59b44847b379578588920cA78FbF26c0B4956C),
            flags,
            type(PumpkinSpiceLatteV4Hook).creationCode,
            constructorArgs
        );

        // Deploy the hook using CREATE2
        vm.startBroadcast();
        PumpkinSpiceLatteV4Hook hook = new PumpkinSpiceLatteV4Hook{salt: salt}(
            poolManager, usdcAddress, vaultAddress, roundDuration, liquidityProviderBonusBps
        );
        vm.stopBroadcast();

        require(address(hook) == hookAddress, "DeployPumpkinSpiceLatteV4Hook: Hook Address Mismatch");

        console.log("PumpkinSpiceLatteV4Hook deployed to:", address(hook));
        console.log("USDC Address:", usdcAddress);
        console.log("Vault Address:", vaultAddress);
        console.log("Pool Manager:", address(poolManager));
        console.log("Round Duration:", roundDuration);
        console.log("LP Bonus BPS:", liquidityProviderBonusBps);
        console.log("Hook Flags:", flags);
        console.log("Salt:", salt);
    }
}
