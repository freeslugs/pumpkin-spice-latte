// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IRandomnessProvider {
    function randomUint256(bytes32 salt) external view returns (uint256);
}
