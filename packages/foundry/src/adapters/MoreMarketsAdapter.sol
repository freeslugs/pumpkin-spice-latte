// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ILendingAdapter} from "../interfaces/ILendingAdapter.sol";

interface IMoreMarketToken {
    function mint(uint256 mintAmount) external returns (uint256);
    function redeemUnderlying(uint256 redeemAmount) external returns (uint256);
    function exchangeRateStored() external view returns (uint256);
    function underlying() external view returns (address);
    function balanceOf(address account) external view returns (uint256);
}

contract MoreMarketsAdapter is ILendingAdapter {
    address public immutable MARKET;
    address public immutable UNDERLYING;

    constructor(address _market) {
        require(_market != address(0), "invalid market");
        MARKET = _market;
        UNDERLYING = IMoreMarketToken(_market).underlying();
    }

    function asset() external view returns (address) {
        return UNDERLYING;
    }

    function deposit(uint256 assets) external returns (uint256 sharesOut) {
        require(assets > 0, "zero assets");

        require(IERC20(UNDERLYING).transferFrom(msg.sender, address(this), assets), "transferFrom failed");
        require(IERC20(UNDERLYING).approve(MARKET, assets), "approve failed");

        uint256 balanceBefore = IMoreMarketToken(MARKET).balanceOf(address(this));
        uint256 err = IMoreMarketToken(MARKET).mint(assets);
        require(err == 0, "mint failed");
        uint256 balanceAfter = IMoreMarketToken(MARKET).balanceOf(address(this));
        sharesOut = balanceAfter - balanceBefore;
    }

    function withdraw(uint256 assets, address receiver) external returns (uint256 sharesBurned) {
        require(assets > 0, "zero assets");
        require(receiver != address(0), "bad receiver");

        uint256 balanceBefore = IMoreMarketToken(MARKET).balanceOf(address(this));
        uint256 err = IMoreMarketToken(MARKET).redeemUnderlying(assets);
        require(err == 0, "redeemUnderlying failed");
        uint256 balanceAfter = IMoreMarketToken(MARKET).balanceOf(address(this));
        sharesBurned = balanceBefore - balanceAfter;

        require(IERC20(UNDERLYING).transfer(receiver, assets), "transfer failed");
    }

    function convertToAssets(uint256 shares) external view returns (uint256 assets) {
        if (shares == 0) return 0;
        uint256 exchangeRate = IMoreMarketToken(MARKET).exchangeRateStored();
        assets = (shares * exchangeRate) / 1e18;
    }
}
