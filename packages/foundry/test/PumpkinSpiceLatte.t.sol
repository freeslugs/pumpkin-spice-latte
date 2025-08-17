// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {PumpkinSpiceLatte} from "../src/PumpkinSpiceLatte.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ILendingAdapter} from "../src/interfaces/ILendingAdapter.sol";
import {IRandomnessProvider} from "../src/interfaces/IRandomnessProvider.sol";

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
        uint256 assetsCurrent = TOKEN.balanceOf(address(this));
        if (totalShares == 0) return 0;
        return (shares * assetsCurrent) / totalShares;
    }
}

contract MockAdapter is ILendingAdapter {
    IERC4626VaultLike public immutable VAULT;
    IERC20 public immutable TOKEN;

    constructor(address _vault) {
        VAULT = IERC4626VaultLike(_vault);
        TOKEN = IERC20(IERC4626VaultLike(_vault).asset());
    }

    function asset() external view returns (address) {
        return address(TOKEN);
    }

    function deposit(uint256 assets) external returns (uint256 sharesOut) {
        // pull from caller (PSL), approve vault, deposit for adapter
        require(TOKEN.transferFrom(msg.sender, address(this), assets), "transferFrom");
        require(TOKEN.approve(address(VAULT), assets), "approve");
        sharesOut = VAULT.deposit(assets, address(this));
    }

    function withdraw(uint256 assets, address receiver) external returns (uint256 sharesBurned) {
        sharesBurned = VAULT.withdraw(assets, receiver, address(this));
    }

    function convertToAssets(uint256 shares) external view returns (uint256 assets) {
        return VAULT.convertToAssets(shares);
    }
}

contract DeterministicRNG is IRandomnessProvider {
    uint256 public n;

    function set(uint256 v) external {
        n = v;
    }

    function randomUint256(bytes32 salt) external view returns (uint256) {
        return uint256(keccak256(abi.encodePacked(n, salt)));
    }
}

//-//////////////////////////////////////////////////////////
//                           TESTS
//-//////////////////////////////////////////////////////////

contract PumpkinSpiceLatteTest is Test {
    PumpkinSpiceLatte public psl;
    MockERC20 public weth;
    MockVault public vault;
    MockAdapter public adapter;
    DeterministicRNG public rng;

    address public user1 = makeAddr("user1");
    address public user2 = makeAddr("user2");

    uint256 public constant BASE_HL = 3600; // 1 hour base half-life
    uint256 public constant HL2 = 3600; // half-life halves every 1 hour since last winner

    function setUp() public {
        weth = new MockERC20("Wrapped Ether", "WETH", 18);
        vault = new MockVault(address(weth));
        adapter = new MockAdapter(address(vault));
        rng = new DeterministicRNG();
        psl = new PumpkinSpiceLatte(address(adapter), address(rng), BASE_HL, HL2);

        // Mint some WETH for users
        weth.mint(user1, 100 ether);
        weth.mint(user2, 100 ether);
    }

    function testDeposit() public {
        vm.startPrank(user1);
        weth.approve(address(psl), 10 ether);
        psl.deposit(10 ether);
        vm.stopPrank();

        assertEq(psl.balanceOf(user1), 10 ether, "User1 balance should be 10 ether");
        assertEq(psl.totalPrincipal(), 10 ether, "Total principal should be 10 ether");
        assertEq(psl.depositors(0), user1, "User1 should be in depositors array");
        // totalAssets equals principal initially
        assertEq(psl.totalAssets(), 10 ether);
    }

    function testWithdraw() public {
        // First, user1 deposits
        vm.startPrank(user1);
        weth.approve(address(psl), 10 ether);
        psl.deposit(10 ether);

        // Then, user1 withdraws
        psl.withdraw(3 ether);
        vm.stopPrank();

        assertEq(psl.balanceOf(user1), 7 ether, "User1 balance should be 7 ether");
        assertEq(psl.totalPrincipal(), 7 ether, "Total principal should be 7 ether");
        assertEq(weth.balanceOf(user1), 93 ether, "User1 WETH balance should be 93 ether");
        assertEq(psl.totalAssets(), 7 ether, "Vault assets should be reduced");
    }

    function testWithdrawFailsIfInsufficientBalance() public {
        vm.startPrank(user1);
        weth.approve(address(psl), 10 ether);
        psl.deposit(10 ether);

        vm.expectRevert("Insufficient balance");
        psl.withdraw(11 ether);
        vm.stopPrank();
    }

    function testFullWithdrawalRemovesDepositor() public {
        // User1 deposits
        vm.startPrank(user1);
        weth.approve(address(psl), 10 ether);
        psl.deposit(10 ether);
        vm.stopPrank();

        // User2 deposits
        vm.startPrank(user2);
        weth.approve(address(psl), 5 ether);
        psl.deposit(5 ether);
        vm.stopPrank();

        assertEq(psl.numberOfDepositors(), 2);

        // User1 withdraws all
        vm.startPrank(user1);
        psl.withdraw(10 ether);
        vm.stopPrank();

        assertEq(psl.numberOfDepositors(), 1, "Number of depositors should be 1");
        assertEq(psl.depositors(0), user2, "Remaining depositor should be user2");
    }

    function testAwardPrize() public {
        // User1 and User2 deposit
        vm.startPrank(user1);
        weth.approve(address(psl), 10 ether);
        psl.deposit(10 ether);
        vm.stopPrank();

        vm.startPrank(user2);
        weth.approve(address(psl), 10 ether);
        psl.deposit(10 ether);
        vm.stopPrank();

        // Simulate yield by donating assets directly to the vault (improves exchange rate)
        weth.mint(address(vault), 1 ether);
        // Now totalAssets should be 21, principal is 20, prize is ~1
        assertEq(psl.totalAssets(), 21 ether);
        assertEq(psl.prizePool(), 1 ether);

        // Initially, drawing immediately should have 0% chance (n=0)
        psl.awardPrize();
        assertEq(psl.lastPrizeAmount(), 0, "No prize should be awarded immediately");

        // Fast forward a large amount of time so threshold saturates to win (n >= 256)
        vm.warp(block.timestamp + 300);

        // Attempt award again; with saturated threshold, it should award
        psl.awardPrize();

        address winner = psl.lastWinner();
        uint256 prizeAmount = psl.lastPrizeAmount();

        assertTrue(winner == user1 || winner == user2, "Winner should be user1 or user2");
        assertApproxEqAbs(prizeAmount, 1 ether, 1, "Prize amount should be ~1 ether");
        // With new accounting, no tokens are withdrawn to the winner. Their external balance remains unchanged.
        assertEq(weth.balanceOf(winner), 90 ether, "Winner's external token balance should be unchanged");
        // Winner's principal balance is credited with the prize
        assertEq(psl.balanceOf(winner), 10 ether + prizeAmount, "Winner's principal should increase by prize");
        // Principal remains fully represented in totalAssets
        assertEq(psl.totalAssets(), psl.totalPrincipal(), "Principal should remain supplied after prize");
    }

    function testNoAwardWithoutYieldEvenIfThresholdPasses() public {
        // User1 deposits
        vm.startPrank(user1);
        weth.approve(address(psl), 10 ether);
        psl.deposit(10 ether);
        vm.stopPrank();

        // Warp far so threshold should pass
        vm.warp(block.timestamp + 300);
        // prizePool is zero since no yield; awardPrize should no-op
        psl.awardPrize();
        assertEq(psl.lastPrizeAmount(), 0, "No prize amount should be set when no yield");
        assertEq(psl.totalAssets(), psl.totalPrincipal(), "Assets should equal principal");
    }

    function testSmoothThresholdBeforeFirstHalfLifeHasPositiveChance() public {
        // Set a large base half-life and very large halfLife2 so effective half-life ~ constant
        psl.setHalfLifeParams(1000, type(uint256).max);

        // Immediately after deployment, chance is 0 (elapsed = 0)
        assertEq(psl.currentWinThreshold(), 0);

        // After a small elapsed time (< half-life), chance should be > 0 but < max
        vm.warp(block.timestamp + 1);
        uint256 t = psl.currentWinThreshold();
        assertGt(t, 0, "Threshold should be > 0 before first full half-life has elapsed");
        assertLt(t, type(uint256).max, "Threshold should be < max before many half-lives");
    }
}
