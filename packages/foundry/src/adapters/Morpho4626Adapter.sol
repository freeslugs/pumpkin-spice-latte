// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ILendingAdapter} from "../interfaces/ILendingAdapter.sol";

interface IERC4626Vault {
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares);
    function convertToAssets(uint256 shares) external view returns (uint256 assets);
    function asset() external view returns (address);
}

contract Morpho4626Adapter is ILendingAdapter {
    address public immutable vault;
    address public immutable underlying;

    constructor(address _vault) {
    vault = _vault;
    underlying = IERC4626Vault(_vault).asset();
    }

    function asset() external view returns (address) {
    return underlying;
    }

    function deposit(uint256 assets) external returns (uint256 sharesOut) {
    require(IERC20(underlying).approve(vault, assets), "Approve failed");
    sharesOut = IERC4626Vault(vault).deposit(assets, address(this));
    }

    function withdraw(uint256 assets, address receiver) external returns (uint256 sharesBurned) {
    sharesBurned = IERC4626Vault(vault).withdraw(assets, receiver, address(this));
    }

    function convertToAssets(uint256 shares) external view returns (uint256 assetsOut) {
    assetsOut = IERC4626Vault(vault).convertToAssets(shares);
    }
}