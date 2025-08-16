// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IRandomnessProvider} from "../interfaces/IRandomnessProvider.sol";

contract PseudoRandomAdapter is IRandomnessProvider {
    function randomUint256(bytes32 salt) external view returns (uint256) {
        return uint256(keccak256(abi.encodePacked(block.prevrandao, block.timestamp, address(this), salt)));
    }
}
