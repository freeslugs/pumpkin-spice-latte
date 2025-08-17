// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ILendingAdapter} from "../interfaces/ILendingAdapter.sol";

interface IERC4626Vault {
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares);
    function convertToAssets(uint256 shares) external view returns (uint256 assets);
    function asset() external view returns (address);
}

contract Morpho4626Adapter is ILendingAdapter {
    using SafeERC20 for IERC20;
    address public immutable VAULT;
    address public immutable UNDERLYING;

    // constructor(address _vault) {
    //     VAULT = _vault;
    //     UNDERLYING = IERC4626Vault(_vault).asset();
    // }

    constructor(address _vault, address _underlying) {
        VAULT = _vault;
        UNDERLYING = _underlying;
    }

    function asset() external view returns (address) {
        return UNDERLYING;
    }

    function deposit(uint256 assets) external returns (uint256 sharesOut) {
        // Pull tokens from caller (e.g., PSL contract) into the adapter
        IERC20(UNDERLYING).safeTransferFrom(msg.sender, address(this), assets);
        // Approve vault to take tokens from adapter
        SafeERC20.forceApprove(IERC20(UNDERLYING), VAULT, assets);
        // Deposit from adapter into the vault, crediting shares to the adapter itself
        sharesOut = IERC4626Vault(VAULT).deposit(assets, address(this));
    }

    function withdraw(uint256 assets, address receiver) external returns (uint256 sharesBurned) {
        sharesBurned = IERC4626Vault(VAULT).withdraw(assets, receiver, address(this));
    }

    function convertToAssets(uint256 shares) external view returns (uint256 assetsOut) {
        assetsOut = IERC4626Vault(VAULT).convertToAssets(shares);
    }
}
