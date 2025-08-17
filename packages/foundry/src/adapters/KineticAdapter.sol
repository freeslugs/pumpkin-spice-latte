// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ILendingAdapter} from "../interfaces/ILendingAdapter.sol";

/**
 * @notice Minimal Kinetic/Compound-style cToken interface
 * @dev Many Compound-like markets expose these functions. Adjust if Kinetic differs.
 */
interface IKineticCToken {
    function mint(uint256 mintAmount) external returns (uint256);
    function redeemUnderlying(uint256 redeemAmount) external returns (uint256);
    function exchangeRateStored() external view returns (uint256);
    function underlying() external view returns (address);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title KineticAdapter
 * @dev Adapter targeting a Kinetic Market interest-bearing token (cToken-like).
 *      Treats market shares as the adapter-held cToken balance.
 */
contract KineticAdapter is ILendingAdapter {
    using SafeERC20 for IERC20;
    address public immutable MARKET; // cToken-like market address
    address public immutable UNDERLYING;

    constructor(address _market) {
        require(_market != address(0), "invalid market");
        MARKET = _market;
        UNDERLYING = IKineticCToken(_market).underlying();
    }

    function asset() external view returns (address) {
        return UNDERLYING;
    }

    /**
     * @notice Deposit `assets` underlying into the market, receiving cTokens held by this adapter.
     * @return sharesOut The number of market shares obtained (delta cToken balance)
     */
    function deposit(uint256 assets) external returns (uint256 sharesOut) {
        require(assets > 0, "zero assets");

        // Pull tokens from caller (PSL) into the adapter
        IERC20(UNDERLYING).safeTransferFrom(msg.sender, address(this), assets);
        // Approve market to pull from adapter; forceApprove handles non-standard approvals
        SafeERC20.forceApprove(IERC20(UNDERLYING), MARKET, assets);

        uint256 balanceBefore = IKineticCToken(MARKET).balanceOf(address(this));
        // Compound-like mint returns 0 on success
        uint256 err = IKineticCToken(MARKET).mint(assets);
        require(err == 0, "mint failed");
        uint256 balanceAfter = IKineticCToken(MARKET).balanceOf(address(this));
        sharesOut = balanceAfter - balanceBefore;
    }

    /**
     * @notice Withdraw `assets` underlying to `receiver` by redeeming market shares held by this adapter.
     * @return sharesBurned The number of market shares consumed (delta cToken balance)
     */
    function withdraw(uint256 assets, address receiver) external returns (uint256 sharesBurned) {
        require(assets > 0, "zero assets");
        require(receiver != address(0), "bad receiver");

        uint256 balanceBefore = IKineticCToken(MARKET).balanceOf(address(this));
        // Compound-like redeemUnderlying returns 0 on success
        uint256 err = IKineticCToken(MARKET).redeemUnderlying(assets);
        require(err == 0, "redeemUnderlying failed");
        uint256 balanceAfter = IKineticCToken(MARKET).balanceOf(address(this));
        sharesBurned = balanceBefore - balanceAfter;

        // Forward withdrawn underlying to receiver
        IERC20(UNDERLYING).safeTransfer(receiver, assets);
    }

    /**
     * @notice Convert market `shares` to underlying assets using the stored exchange rate.
     * @dev Assumes exchangeRateStored is scaled by 1e18; adjust if Kinetic differs.
     */
    function convertToAssets(uint256 shares) external view returns (uint256 assets) {
        if (shares == 0) return 0;
        uint256 exchangeRate = IKineticCToken(MARKET).exchangeRateStored();
        assets = (shares * exchangeRate) / 1e18;
    }
}
