// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PumpkinSpiceLatteV4Hook} from "../src/PumpkinSpiceLatteV4Hook.sol";
import {PumpkinSpiceLatteEnhanced} from "../src/PumpkinSpiceLatte.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ILendingAdapter} from "../src/interfaces/ILendingAdapter.sol";
import {IRandomnessProvider} from "../src/interfaces/IRandomnessProvider.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {HookMiner} from "v4-periphery/src/utils/HookMiner.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {BalanceDelta} from "v4-core/src/types/BalanceDelta.sol";
import {SwapParams, ModifyLiquidityParams} from "v4-core/src/types/PoolOperation.sol";

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

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
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

contract MockVault {
    IERC20 public immutable TOKEN;
    uint256 public totalShares;
    mapping(address => uint256) public shareOf;

    constructor(address _asset) {
        TOKEN = IERC20(_asset);
    }

    function asset() external view returns (address) {
        return address(TOKEN);
    }

    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
        require(TOKEN.transferFrom(msg.sender, address(this), assets), "Transfer failed");
        shares = totalShares == 0 ? assets : (assets * totalShares) / TOKEN.balanceOf(address(this));
        totalShares += shares;
        shareOf[receiver] += shares;
    }

    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares) {
        uint256 totalAssets = TOKEN.balanceOf(address(this));
        shares = (assets * totalShares) / totalAssets;
        shareOf[owner] -= shares;
        totalShares -= shares;
        require(TOKEN.transfer(receiver, assets), "Transfer failed");
    }

    function convertToAssets(uint256 shares) external view returns (uint256 assets) {
        if (totalShares == 0) return 0;
        return (shares * TOKEN.balanceOf(address(this))) / totalShares;
    }

    function maxWithdraw(address owner) external view returns (uint256) {
        if (totalShares == 0) return 0;
        return (shareOf[owner] * TOKEN.balanceOf(address(this))) / totalShares;
    }
}

contract MockLendingAdapter is ILendingAdapter {
    MockVault public immutable vault;
    address public immutable underlying;

    constructor(address _vault) {
        vault = MockVault(_vault);
        underlying = MockVault(_vault).asset();
    }

    function asset() external view returns (address) {
        return underlying;
    }

    function deposit(uint256 assets) external returns (uint256 sharesOut) {
        require(IERC20(underlying).transferFrom(msg.sender, address(this), assets), "Transfer failed");
        require(IERC20(underlying).approve(address(vault), assets), "Approve failed");
        sharesOut = vault.deposit(assets, address(this));
    }

    function withdraw(uint256 assets, address receiver) external returns (uint256 sharesBurned) {
        sharesBurned = vault.withdraw(assets, receiver, address(this));
    }

    function convertToAssets(uint256 shares) external view returns (uint256 assets) {
        return vault.convertToAssets(shares);
    }
}

contract MockRandomnessProvider is IRandomnessProvider {
    function randomUint256(bytes32 salt) external view returns (uint256) {
        return uint256(keccak256(abi.encodePacked(block.prevrandao, block.timestamp, address(this), salt)));
    }
}

contract MockPoolManager {
    address public hook;

    function setHook(address _hook) external {
        hook = _hook;
    }
}

//-//////////////////////////////////////////////////////////
//                           TESTS
//-//////////////////////////////////////////////////////////

contract PumpkinSpiceLatteV4HookSeparatedTest is Test {
    using PoolIdLibrary for PoolKey;

    PumpkinSpiceLatteV4Hook public hook;
    PumpkinSpiceLatteEnhanced public plsa;
    MockERC20 public usdc;
    MockVault public vault;
    MockLendingAdapter public adapter;
    MockRandomnessProvider public randomnessProvider;
    MockPoolManager public poolManager;

    address public alice = address(0x1);
    address public bob = address(0x2);

    uint256 public constant INITIAL_BALANCE = 1000 * 10 ** 6; // 1000 USDC
    uint256 public constant DEPOSIT_AMOUNT = 100 * 10 ** 6; // 100 USDC

    function setUp() public {
        // Deploy mocks
        usdc = new MockERC20("USD Coin", "USDC", 6);
        vault = new MockVault(address(usdc));
        adapter = new MockLendingAdapter(address(vault));
        randomnessProvider = new MockRandomnessProvider();
        poolManager = new MockPoolManager();

        // Deploy PLSA contract first
        plsa = new PumpkinSpiceLatteEnhanced(
            address(adapter),
            address(randomnessProvider),
            86400 // 1 day
        );

        // Mine hook address with correct flags
        uint160 flags = uint160(
            Hooks.AFTER_ADD_LIQUIDITY_FLAG | Hooks.AFTER_ADD_LIQUIDITY_RETURNS_DELTA_FLAG
                | Hooks.BEFORE_REMOVE_LIQUIDITY_FLAG | Hooks.AFTER_REMOVE_LIQUIDITY_FLAG | Hooks.BEFORE_SWAP_FLAG
                | Hooks.AFTER_SWAP_FLAG
        );

        bytes memory constructorArgs = abi.encode(IPoolManager(address(poolManager)), address(plsa));

        (address hookAddress, bytes32 salt) =
            HookMiner.find(address(this), flags, type(PumpkinSpiceLatteV4Hook).creationCode, constructorArgs);

        // Deploy hook
        hook = new PumpkinSpiceLatteV4Hook{salt: salt}(IPoolManager(address(poolManager)), address(plsa));

        require(address(hook) == hookAddress, "Hook address mismatch");

        // Set hook in PLSA
        plsa.setHookContract(address(hook));

        // Setup balances
        usdc.mint(alice, INITIAL_BALANCE);
        usdc.mint(bob, INITIAL_BALANCE);
        usdc.mint(address(this), INITIAL_BALANCE);

        // Setup approvals
        vm.startPrank(alice);
        usdc.approve(address(plsa), type(uint256).max);
        vm.stopPrank();

        vm.startPrank(bob);
        usdc.approve(address(plsa), type(uint256).max);
        vm.stopPrank();
    }

    function test_SeparatedArchitecture() public {
        // Test that hook and PLSA are properly connected
        assertEq(address(hook.PLSA_CONTRACT()), address(plsa), "Hook should reference PLSA");
        assertEq(plsa.hookContract(), address(hook), "PLSA should reference hook");
        assertEq(hook.getPrimaryAsset(), address(usdc), "Hook should know primary asset");
    }

    function test_PLSADeposit() public {
        vm.startPrank(alice);

        uint256 balanceBefore = usdc.balanceOf(alice);
        plsa.deposit(DEPOSIT_AMOUNT);

        assertEq(plsa.balanceOf(alice), DEPOSIT_AMOUNT, "PLSA balance should be updated");
        assertEq(plsa.totalPrincipal(), DEPOSIT_AMOUNT, "Total principal should be updated");
        assertEq(usdc.balanceOf(alice), balanceBefore - DEPOSIT_AMOUNT, "USDC should be transferred");
        assertEq(plsa.numberOfDepositors(), 1, "Should have one depositor");

        vm.stopPrank();
    }

    function test_PLSAWithdraw() public {
        // Setup: Alice deposits
        vm.startPrank(alice);
        plsa.deposit(DEPOSIT_AMOUNT);

        uint256 balanceBefore = usdc.balanceOf(alice);
        plsa.withdraw(DEPOSIT_AMOUNT);

        assertEq(plsa.balanceOf(alice), 0, "PLSA balance should be zero");
        assertEq(plsa.totalPrincipal(), 0, "Total principal should be zero");
        assertEq(usdc.balanceOf(alice), balanceBefore + DEPOSIT_AMOUNT, "USDC should be returned");
        assertEq(plsa.numberOfDepositors(), 0, "Should have no depositors");

        vm.stopPrank();
    }

    function test_HookLiquidityHandling() public {
        // Setup: Alice is a depositor
        vm.startPrank(alice);
        plsa.deposit(DEPOSIT_AMOUNT);
        vm.stopPrank();

        uint256 liquidityAmount = 50 * 10 ** 6;
        uint256 aliceBalanceBefore = plsa.balanceOf(alice);

        // Simulate hook calling handleLiquidityAdded - first mint USDC to PLSA
        usdc.mint(address(plsa), liquidityAmount);
        vm.startPrank(address(hook));
        plsa.handleLiquidityAdded(alice, liquidityAmount);
        vm.stopPrank();

        // Check LP tracking
        assertEq(plsa.lpBalances(alice), liquidityAmount, "LP balance should be tracked");
        assertEq(plsa.numberOfLiquidityProviders(), 1, "Should have 1 LP");

        // Check bonus (5% of liquidity amount)
        uint256 expectedBonus = (liquidityAmount * 500) / 10000; // 5%
        assertEq(plsa.balanceOf(alice), aliceBalanceBefore + expectedBonus, "Should receive LP bonus");
    }

    function test_HookSwapFeeHandling() public {
        uint256 feeAmount = 10 * 10 ** 6; // 10 USDC
        uint256 feesBefore = plsa.accumulatedSwapFees();

        // Simulate hook depositing swap fees
        vm.startPrank(address(hook));
        plsa.depositSwapFees(feeAmount);
        vm.stopPrank();

        assertEq(plsa.accumulatedSwapFees(), feesBefore + feeAmount, "Fees should be accumulated");
    }

    function test_SwapperBonusTickets() public {
        uint256 feeAmount = 100 * 10 ** 6; // 100 USDC
        address swapper = address(0x999);

        // Check initial tickets
        (uint256 depositorTickets, uint256 lpTicketsBefore) = plsa.getLotteryTickets(swapper);
        assertEq(lpTicketsBefore, 0, "Swapper should start with no tickets");

        // Simulate hook depositing swap fees with swapper bonus
        vm.startPrank(address(hook));
        plsa.depositSwapFeesWithBonus(feeAmount, swapper);
        vm.stopPrank();

        // Check swapper received bonus tickets
        (, uint256 lpTicketsAfter) = plsa.getLotteryTickets(swapper);
        uint256 expectedBonusTickets = (feeAmount * 100) / 10000; // 1% bonus
        assertEq(lpTicketsAfter, expectedBonusTickets, "Swapper should receive bonus tickets");
    }

    function test_EnhancedLotteryTickets() public {
        // Setup: Alice deposits and provides liquidity
        vm.startPrank(alice);
        plsa.deposit(DEPOSIT_AMOUNT);
        vm.stopPrank();

        uint256 liquidityAmount = 50 * 10 ** 6;

        // Alice becomes LP - first mint USDC to PLSA to simulate hook transfer
        usdc.mint(address(plsa), liquidityAmount);
        vm.startPrank(address(hook));
        plsa.handleLiquidityAdded(alice, liquidityAmount);
        vm.stopPrank();

        // Check Alice's lottery tickets
        (uint256 depositorTickets, uint256 lpTickets) = plsa.getLotteryTickets(alice);

        assertEq(
            depositorTickets, DEPOSIT_AMOUNT + (liquidityAmount * 500) / 10000, "Should include deposit + LP bonus"
        );
        uint256 expectedLpTickets = (liquidityAmount * 200) / 100; // 2x multiplier
        assertEq(lpTickets, expectedLpTickets, "Should have LP bonus tickets");

        // Check total lottery tickets
        uint256 totalTickets = plsa.getTotalLotteryTickets();
        assertGt(totalTickets, DEPOSIT_AMOUNT, "Total tickets should include LP bonuses");
    }

    function test_HookLiquidityRequest() public {
        // Setup: Add some liquidity to PLSA
        vm.startPrank(alice);
        plsa.deposit(DEPOSIT_AMOUNT);
        vm.stopPrank();

        uint256 requestAmount = 50 * 10 ** 6;

        // Simulate hook requesting liquidity
        vm.startPrank(address(hook));
        uint256 available = plsa.requestLiquidity(requestAmount);
        vm.stopPrank();

        assertGt(available, 0, "Should provide some liquidity");
        assertEq(available, requestAmount, "Should provide requested amount");
    }

    function test_HookPermissions() public {
        // Test hook permissions are correct
        Hooks.Permissions memory permissions = hook.getHookPermissions();

        assertFalse(permissions.beforeInitialize, "beforeInitialize should be false");
        assertTrue(permissions.afterAddLiquidity, "afterAddLiquidity should be true");
        assertTrue(permissions.afterAddLiquidityReturnDelta, "afterAddLiquidityReturnDelta should be true");
        assertTrue(permissions.beforeRemoveLiquidity, "beforeRemoveLiquidity should be true");
        assertTrue(permissions.afterRemoveLiquidity, "afterRemoveLiquidity should be true");
        assertTrue(permissions.beforeSwap, "beforeSwap should be true");
        assertTrue(permissions.afterSwap, "afterSwap should be true");
    }

    function test_OnlyHookCanCallPLSAFunctions() public {
        // Test that only hook can call PLSA hook functions
        vm.expectRevert("Only hook contract");
        plsa.handleLiquidityAdded(alice, 100);

        vm.expectRevert("Only hook contract");
        plsa.depositSwapFees(100);

        vm.expectRevert("Only hook contract");
        plsa.requestLiquidity(100);
    }

    function test_AdminFunctions() public {
        // Test PLSA admin functions
        plsa.setTargetPoolBufferBps(1500);
        assertEq(plsa.targetPoolBufferBps(), 1500, "Target buffer should be updated");

        plsa.setLpBonusBps(1000);
        assertEq(plsa.lpBonusBps(), 1000, "LP bonus should be updated");

        // Test hook admin functions
        hook.setPaused(true);
        assertTrue(hook.paused(), "Hook should be paused");
    }

    function test_PrizePoolCalculation() public {
        // Setup: Alice deposits
        vm.startPrank(alice);
        plsa.deposit(DEPOSIT_AMOUNT);
        vm.stopPrank();

        // Add some fees
        vm.startPrank(address(hook));
        plsa.depositSwapFees(10 * 10 ** 6);
        vm.stopPrank();

        // Check prize pool includes fees
        uint256 prizePool = plsa.prizePool();
        assertGt(prizePool, 0, "Prize pool should include fees");
    }

    function test_ViewFunctions() public {
        // Test various view functions
        assertEq(plsa.timeUntilNextPrize() > 0, true, "Should have time until next prize");
        assertEq(plsa.isProvider(alice), false, "Alice should not be LP initially");
        assertEq(hook.isLiquidityProvider(alice), false, "Hook should also report Alice not LP");

        // Make Alice an LP - first mint USDC to PLSA
        usdc.mint(address(plsa), 100 * 10 ** 6);
        vm.startPrank(address(hook));
        plsa.handleLiquidityAdded(alice, 100 * 10 ** 6);
        vm.stopPrank();

        assertTrue(plsa.isProvider(alice), "Alice should be LP now");
        assertTrue(hook.isLiquidityProvider(alice), "Hook should also report Alice as LP");
    }

    function test_EmergencyFunctions() public {
        // Test emergency functions
        plsa.setPaused(true);
        hook.setPaused(true);

        // Mint some tokens for testing
        usdc.mint(address(plsa), 100 * 10 ** 6);

        // Test emergency withdraw from PLSA
        uint256 balanceBefore = usdc.balanceOf(address(this));
        plsa.emergencyWithdraw(address(usdc), 50 * 10 ** 6);
        assertEq(usdc.balanceOf(address(this)), balanceBefore + 50 * 10 ** 6, "Should receive emergency withdrawal");
    }
}
