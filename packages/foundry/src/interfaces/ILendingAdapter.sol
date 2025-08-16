// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ILendingAdapter {
    function asset() external view returns (address);
    function deposit(uint256 assets) external returns (uint256 sharesOut);
    function withdraw(uint256 assets, address receiver) external returns (uint256 sharesBurned);
    function convertToAssets(uint256 shares) external view returns (uint256 assets);
}
