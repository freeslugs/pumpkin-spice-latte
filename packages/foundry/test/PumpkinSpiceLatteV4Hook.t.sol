// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PumpkinSpiceLatteV4Hook} from "../src/PumpkinSpiceLatteV4Hook.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {HookMiner} from "v4-periphery/src/utils/HookMiner.sol";

//-//////////////////////////////////////////////////////////
//                           MOCKS
//-//////////////////////////////////////////////////////////

contract MockERC20 is IERC20 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    uint256 public totalSupply;
    string public name;
    string public symbol;
    uint8 public decimals;

    constructor(string memory _name, string memory _symbol, uint8 _decimals) {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
    }

    function _mint(address _to, uint256 _amount) internal {
        balanceOf[_to] += _amount;
        totalSupply += _amount;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function transfer(address _to, uint256 _amount) external returns (bool) {
        balanceOf[msg.sender] -= _amount;
        balanceOf[_to] += _amount;
        return true;
    }

    function approve(address _spender, uint256 _amount) external returns (bool) {
        allowance[msg.sender][_spender] = _amount;
        return true;
    }

    function transferFrom(address _from, address _to, uint256 _amount) external returns (bool) {
        allowance[_from][msg.sender] -= _amount;
        balanceOf[_from] -= _amount;
        balanceOf[_to] += _amount;
        return true;
    }
}

interface IERC4626VaultLike {
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares);
    function convertToAssets(uint256 shares) external view returns (uint256 assets);
    function asset() external view returns (address);
}

contract MockVault is IERC4626VaultLike {
    IERC20 public immutable TOKEN;
    uint256 public totalShares;
    uint256 public yieldRate = 100; // Start with no yield

    mapping(address => uint256) public shareOf;

    constructor(address _asset) {
        TOKEN = IERC20(_asset);
    }

    function asset() external view returns (address) {
        return address(TOKEN);
    }

    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
        uint256 assetsBefore = TOKEN.balanceOf(address(this));
        uint256 sharesBefore = totalShares;
        // Pull in assets first
        require(TOKEN.transferFrom(msg.sender, address(this), assets), "Transfer failed");
        uint256 assetsAfter = TOKEN.balanceOf(address(this));
        uint256 received = assetsAfter - assetsBefore;

        if (sharesBefore == 0) {
            shares = received;
        } else {
            shares = assetsBefore == 0 ? received : (received * sharesBefore) / assetsBefore;
        }

        totalShares = sharesBefore + shares;
        shareOf[receiver] += shares;
    }

    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares) {
        uint256 assetsCurrent = TOKEN.balanceOf(address(this));
        require(assetsCurrent > 0 && totalShares > 0, "no liquidity");
        shares = (assets * totalShares) / assetsCurrent;
        // Burn shares from owner
        shareOf[owner] -= shares;
        totalShares -= shares;
        // Send assets to receiver
        require(TOKEN.transfer(receiver, assets), "Transfer failed");
    }

    function convertToAssets(uint256 shares) external view returns (uint256 assets) {
        if (totalShares == 0) return 0;
        // Simple 1:1 conversion initially, yield rate applied only when there's actual yield
        return (shares * TOKEN.balanceOf(address(this))) / totalShares;
    }

    // Function to simulate yield by increasing the yield rate
    function simulateYield(uint256 newYieldRate) external {
        yieldRate = newYieldRate;
    }
}

contract MockPoolManager {
    // Simple mock for testing - we don't need the full IPoolManager interface
    address public hook;

    constructor() {}

    function setHook(address _hook) external {
        hook = _hook;
    }
}

//-//////////////////////////////////////////////////////////
//                           TESTS
//-//////////////////////////////////////////////////////////

contract PumpkinSpiceLatteV4HookTest is Test {
    PumpkinSpiceLatteV4Hook public hook;
    MockERC20 public usdc;
    MockVault public vault;
    MockPoolManager public poolManager;

    address public alice = address(0x1);
    address public bob = address(0x2);
    address public charlie = address(0x3);

    uint256 public constant INITIAL_BALANCE = 1000 * 10 ** 6; // 1000 USDC
    uint256 public constant DEPOSIT_AMOUNT = 100 * 10 ** 6; // 100 USDC

    function setUp() public {
        // Deploy mocks
        usdc = new MockERC20("USD Coin", "USDC", 6);
        vault = new MockVault(address(usdc));
        poolManager = new MockPoolManager();

        // Hook contracts must have specific flags encoded in the address
        uint160 flags = uint160(
            Hooks.BEFORE_ADD_LIQUIDITY_FLAG | Hooks.AFTER_ADD_LIQUIDITY_FLAG | Hooks.BEFORE_REMOVE_LIQUIDITY_FLAG
                | Hooks.AFTER_REMOVE_LIQUIDITY_FLAG | Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG
        );

        // Mine a salt that will produce a hook address with the correct flags
        bytes memory constructorArgs = abi.encode(
            IPoolManager(address(poolManager)),
            address(usdc),
            address(vault),
            86400, // 1 day
            2000 // 20% LP bonus
        );

        (address hookAddress, bytes32 salt) =
            HookMiner.find(address(this), flags, type(PumpkinSpiceLatteV4Hook).creationCode, constructorArgs);

        // Deploy the hook using CREATE2 with the mined salt
        hook = new PumpkinSpiceLatteV4Hook{salt: salt}(
            IPoolManager(address(poolManager)),
            address(usdc),
            address(vault),
            86400, // 1 day
            2000 // 20% LP bonus
        );

        // Verify the hook address matches
        require(address(hook) == hookAddress, "Hook address mismatch");

        // Set the hook in the pool manager
        poolManager.setHook(address(hook));

        // Setup initial balances
        usdc.mint(alice, INITIAL_BALANCE);
        usdc.mint(bob, INITIAL_BALANCE);
        usdc.mint(charlie, INITIAL_BALANCE);

        // Setup approvals
        vm.startPrank(alice);
        usdc.approve(address(hook), type(uint256).max);
        vm.stopPrank();

        vm.startPrank(bob);
        usdc.approve(address(hook), type(uint256).max);
        vm.stopPrank();

        vm.startPrank(charlie);
        usdc.approve(address(hook), type(uint256).max);
        vm.stopPrank();
    }

    function test_Deposit() public {
        vm.startPrank(alice);

        uint256 balanceBefore = usdc.balanceOf(alice);
        hook.deposit(DEPOSIT_AMOUNT);

        assertEq(hook.balanceOf(alice), DEPOSIT_AMOUNT, "Balance should be updated");
        assertEq(hook.totalPrincipal(), DEPOSIT_AMOUNT, "Total principal should be updated");
        assertEq(usdc.balanceOf(alice), balanceBefore - DEPOSIT_AMOUNT, "USDC should be transferred");
        assertEq(hook.numberOfDepositors(), 1, "Should have one depositor");

        vm.stopPrank();
    }

    function test_MultipleDeposits() public {
        // Alice deposits
        vm.startPrank(alice);
        hook.deposit(DEPOSIT_AMOUNT);
        vm.stopPrank();

        // Bob deposits
        vm.startPrank(bob);
        hook.deposit(DEPOSIT_AMOUNT);
        vm.stopPrank();

        assertEq(hook.numberOfDepositors(), 2, "Should have two depositors");
        assertEq(hook.totalPrincipal(), DEPOSIT_AMOUNT * 2, "Total principal should be doubled");
    }

    function test_Withdraw() public {
        // Setup: Alice deposits
        vm.startPrank(alice);
        hook.deposit(DEPOSIT_AMOUNT);

        uint256 balanceBefore = usdc.balanceOf(alice);
        hook.withdraw(DEPOSIT_AMOUNT);

        assertEq(hook.balanceOf(alice), 0, "Balance should be zero");
        assertEq(hook.totalPrincipal(), 0, "Total principal should be zero");
        assertEq(usdc.balanceOf(alice), balanceBefore + DEPOSIT_AMOUNT, "USDC should be returned");
        assertEq(hook.numberOfDepositors(), 0, "Should have no depositors");

        vm.stopPrank();
    }

    function test_PLSABonusForLiquidityProvider() public {
        // Setup: Alice deposits to PLSA
        vm.startPrank(alice);
        hook.deposit(DEPOSIT_AMOUNT);
        vm.stopPrank();

        // Alice adds liquidity (simulate hook call)
        uint256 liquidityAmount = 100 * 10 ** 6; // 100 USDC worth of liquidity

        // Simulate the full hook logic: add liquidity provider
        hook._addLiquidityProvider(alice, liquidityAmount);

        // Check that Alice is tracked as a liquidity provider
        assertEq(hook.userLiquidity(alice), liquidityAmount, "Alice's liquidity should be tracked");
        assertEq(hook.numberOfLiquidityProviders(), 1, "Should have 1 liquidity provider");

        // Check that Alice is a PLSA depositor
        assertEq(hook.balanceOf(alice), DEPOSIT_AMOUNT, "Alice should be a PLSA depositor");
    }

    function test_NoBonusForNonPLSAUser() public {
        // Bob adds liquidity without being a PLSA depositor
        uint256 liquidityAmount = 100 * 10 ** 6;
        hook._addLiquidityProvider(bob, liquidityAmount);

        // Check that Bob got no bonus
        assertEq(hook.balanceOf(bob), 0, "Non-PLSA user should get no bonus");
        assertEq(hook.totalPrincipal(), 0, "Total principal should not change");
    }

    function test_FeeDistributionToDepositors() public {
        // Setup: Alice and Bob deposit
        vm.startPrank(alice);
        hook.deposit(DEPOSIT_AMOUNT);
        vm.stopPrank();

        vm.startPrank(bob);
        hook.deposit(DEPOSIT_AMOUNT);
        vm.stopPrank();

        // Simulate fee accumulation
        uint256 fees = 100 * 10 ** 6; // 100 USDC in fees
        hook._distributeFeesToDepositors(fees);

        // Check that fees were distributed proportionally
        uint256 aliceFees = (DEPOSIT_AMOUNT * fees) / (DEPOSIT_AMOUNT * 2);
        uint256 bobFees = (DEPOSIT_AMOUNT * fees) / (DEPOSIT_AMOUNT * 2);

        assertEq(hook.balanceOf(alice), DEPOSIT_AMOUNT + aliceFees, "Alice should receive fees");
        assertEq(hook.balanceOf(bob), DEPOSIT_AMOUNT + bobFees, "Bob should receive fees");
        assertEq(hook.totalPrincipal(), DEPOSIT_AMOUNT * 2 + fees, "Total principal should include fees");
    }

    function test_LiquidityProviderTracking() public {
        // Add liquidity providers
        hook._addLiquidityProvider(alice, 100 * 10 ** 6);
        hook._addLiquidityProvider(bob, 200 * 10 ** 6);

        assertEq(hook.numberOfLiquidityProviders(), 2, "Should have 2 liquidity providers");
        assertEq(hook.userLiquidity(alice), 100 * 10 ** 6, "Alice's liquidity should be tracked");
        assertEq(hook.userLiquidity(bob), 200 * 10 ** 6, "Bob's liquidity should be tracked");

        // Remove liquidity
        hook._removeLiquidityProvider(alice, 50 * 10 ** 6);
        assertEq(hook.userLiquidity(alice), 50 * 10 ** 6, "Alice's liquidity should be reduced");
        assertEq(hook.numberOfLiquidityProviders(), 2, "Should still have 2 providers");

        // Remove all liquidity
        hook._removeLiquidityProvider(alice, 50 * 10 ** 6);
        assertEq(hook.numberOfLiquidityProviders(), 1, "Should have 1 provider after removal");
        assertEq(hook.userLiquidity(alice), 0, "Alice's liquidity should be zero");
    }

    function test_PrizePoolCalculation() public {
        // Setup: Alice and Bob deposit
        vm.startPrank(alice);
        hook.deposit(DEPOSIT_AMOUNT);
        vm.stopPrank();

        vm.startPrank(bob);
        hook.deposit(DEPOSIT_AMOUNT);
        vm.stopPrank();

        // Check initial prize pool (should be 0 since no yield yet)
        assertEq(hook.prizePool(), 0, "Prize pool should be 0 initially");

        // Simulate yield by minting tokens to the vault
        usdc.mint(address(vault), DEPOSIT_AMOUNT / 10);

        // Now prize pool should have yield
        assertGt(hook.prizePool(), 0, "Prize pool should have yield");
    }

    function test_AwardPrize() public {
        // Setup: Alice and Bob deposit
        vm.startPrank(alice);
        hook.deposit(DEPOSIT_AMOUNT);
        vm.stopPrank();

        vm.startPrank(bob);
        hook.deposit(DEPOSIT_AMOUNT);
        vm.stopPrank();

        // Simulate yield by minting tokens to the vault
        usdc.mint(address(vault), DEPOSIT_AMOUNT / 10);

        // Fast forward time
        vm.warp(block.timestamp + 86400 + 1);

        // Award prize
        hook.awardPrize();

        // Check that a winner was selected
        assertTrue(hook.lastWinner() == alice || hook.lastWinner() == bob, "Winner should be Alice or Bob");
        assertGt(hook.lastPrizeAmount(), 0, "Prize amount should be greater than 0");
    }

    function test_RevertWhenAwardingPrizeTooEarly() public {
        // Setup: Alice deposits
        vm.startPrank(alice);
        hook.deposit(DEPOSIT_AMOUNT);
        vm.stopPrank();

        // Try to award prize before round ends
        vm.expectRevert("Round not finished");
        hook.awardPrize();
    }

    function test_RevertWhenNoDepositors() public {
        // Fast forward time
        vm.warp(block.timestamp + 86400 + 1);

        // Try to award prize with no depositors
        vm.expectRevert("No depositors");
        hook.awardPrize();
    }

    function test_RevertWhenNoPrize() public {
        // Setup: Alice deposits
        vm.startPrank(alice);
        hook.deposit(DEPOSIT_AMOUNT);
        vm.stopPrank();

        // Fast forward time
        vm.warp(block.timestamp + 86400 + 1);

        // Try to award prize with no yield
        vm.expectRevert("No prize to award");
        hook.awardPrize();
    }
}
