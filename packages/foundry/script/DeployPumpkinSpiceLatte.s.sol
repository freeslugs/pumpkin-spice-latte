// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {PumpkinSpiceLatte} from "../src/PumpkinSpiceLatte.sol";
import {Morpho4626Adapter} from "../src/adapters/Morpho4626Adapter.sol";
import {PseudoRandomAdapter} from "../src/adapters/PseudoRandomAdapter.sol";
 import {ChainlinkVRFAdapter} from "../src/adapters/ChainlinkVRFAdapter.sol";

contract DeployPumpkinSpiceLatte is Script {
    function run() external {
        // Config
        address vaultAddress = 0xd63070114470f685b75B74D60EEc7c1113d33a3D; // mainnet vault
        uint256 roundDuration = 300; // 5 minutes

        // RNG selection
        bool useVRF = false;
        // Set USE_VRF=true in env to use Chainlink VRF adapter
        try vm.envBool("USE_VRF") returns (bool v) {
            useVRF = v;
        } catch {}

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        Morpho4626Adapter adapter = new Morpho4626Adapter(vaultAddress);

        address rngAddress;
        ChainlinkVRFAdapter vrfAdapter;
        if (useVRF) {
            address vrfCoordinator = vm.envAddress("VRF_COORDINATOR");
            bytes32 vrfKeyHash = vm.envBytes32("VRF_KEY_HASH");
            uint256 vrfSubId = vm.envUint("VRF_SUBSCRIPTION_ID");
            uint32 vrfCallbackGasLimit = uint32(vm.envUint("VRF_CALLBACK_GAS_LIMIT"));
            uint16 vrfRequestConfs = uint16(vm.envUint("VRF_REQUEST_CONFIRMATIONS"));
            bool nativePayment = false;
            try vm.envBool("VRF_NATIVE_PAYMENT") returns (bool np) {
                nativePayment = np;
            } catch {}

            vrfAdapter = new ChainlinkVRFAdapter(
                vrfCoordinator,
                vrfKeyHash,
                vrfSubId,
                vrfCallbackGasLimit,
                vrfRequestConfs,
                nativePayment
            );
            rngAddress = address(vrfAdapter);
        } else {
            rngAddress = address(new PseudoRandomAdapter());
        }

        PumpkinSpiceLatte psl = new PumpkinSpiceLatte(
            address(adapter),
            rngAddress,
            roundDuration
        );

        // Optionally kick off an initial VRF request so randomness is seeded
        if (useVRF) {
            vrfAdapter.requestRandomness();
        }

        vm.stopBroadcast();

        console.log("PumpkinSpiceLatte deployed:", address(psl));
        console.log("Adapter:", address(adapter));
        console.log("RNG:", rngAddress);
    }
}
