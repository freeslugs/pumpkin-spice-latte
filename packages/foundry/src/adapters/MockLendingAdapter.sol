// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ILendingAdapter} from "../interfaces/ILendingAdapter.sol";

/**
 * @title MockLendingAdapter
 * @notice Mock adapter for testing purposes - implements ILendingAdapter without external calls
 * @dev This is a simplified adapter that just tracks deposits/withdrawals for testing
 */
contract MockLendingAdapter is ILendingAdapter {
    address public immutable UNDERLYING;
    
    // Mock exchange rate (1:1 for simplicity)
    uint256 public constant EXCHANGE_RATE = 1e18;
    
    // Track total shares minted
    uint256 public totalShares;
    
    // Track user shares
    mapping(address => uint256) public userShares;
    
    // Track underlying balance
    uint256 public underlyingBalance;

    constructor(address _underlying) {
        require(_underlying != address(0), "invalid underlying");
        UNDERLYING = _underlying;
    }

    function asset() external view returns (address) {
        return UNDERLYING;
    }

    function deposit(uint256 assets) external returns (uint256 sharesOut) {
        require(assets > 0, "zero assets");
        
        // Transfer tokens from caller
        require(IERC20(UNDERLYING).transferFrom(msg.sender, address(this), assets), "transferFrom failed");
        
        // Calculate shares (1:1 ratio for simplicity)
        sharesOut = assets;
        
        // Update state
        underlyingBalance += assets;
        totalShares += sharesOut;
        userShares[msg.sender] += sharesOut;
        
        // Mint shares to caller
        // Note: In a real implementation, this would mint ERC20 shares
    }

    function withdraw(uint256 assets, address receiver) external returns (uint256 sharesBurned) {
        require(assets > 0, "zero assets");
        require(receiver != address(0), "bad receiver");
        require(userShares[msg.sender] >= assets, "insufficient shares");
        
        // Calculate shares to burn (1:1 ratio)
        sharesBurned = assets;
        
        // Update state
        underlyingBalance -= assets;
        totalShares -= sharesBurned;
        userShares[msg.sender] -= sharesBurned;
        
        // Transfer underlying to receiver
        require(IERC20(UNDERLYING).transfer(receiver, assets), "transfer failed");
    }

    function convertToAssets(uint256 shares) external view returns (uint256 assets) {
        if (shares == 0) return 0;
        // 1:1 ratio for simplicity
        assets = shares;
    }
    
    // Mock function to simulate yield (for testing)
    function simulateYield(uint256 amount) external {
        // This would be called by the protocol to simulate yield
        underlyingBalance += amount;
    }
}
