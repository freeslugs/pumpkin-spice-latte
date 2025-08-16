// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {PumpkinSpiceLatte} from "../src/PumpkinSpiceLatte.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

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

contract MockMorpho {
    mapping(bytes32 => uint256) public suppliedAssets;
    mapping(bytes32 => uint256) public suppliedShares;
    IERC20 public asset;

    constructor(address _asset) {
        asset = IERC20(_asset);
    }

    function supply(bytes32 marketId, uint256 assets, uint256, address, bytes calldata) external returns (uint256 sharesOut, uint256) {
        suppliedAssets[marketId] += assets;
        // Simple 1:1 asset-to-share conversion for mock
        sharesOut = assets;
        suppliedShares[marketId] += sharesOut;
        asset.transferFrom(msg.sender, address(this), assets);
        return (sharesOut, assets);
    }

    function withdraw(bytes32 marketId, uint256 assets, uint256, address to, address) external returns (uint256 sharesOut, uint256) {
        suppliedAssets[marketId] -= assets;
        // Simple 1:1 asset-to-share conversion for mock
        sharesOut = assets;
        suppliedShares[marketId] -= sharesOut;
        asset.transfer(to, assets);
        return (sharesOut, assets);
    }

    function market(bytes32 marketId) external view returns (uint128, uint128, uint128, uint128, uint128, uint128) {
        return (
            uint128(suppliedAssets[marketId]),
            uint128(suppliedShares[marketId]),
            0, 0, 0, 0
        );
    }
}


//-//////////////////////////////////////////////////////////
//                           TESTS
//-//////////////////////////////////////////////////////////

contract PumpkinSpiceLatteTest is Test {
    PumpkinSpiceLatte public psl;
    MockERC20 public weth;
    MockMorpho public morpho;

    address public user1 = makeAddr("user1");
    address public user2 = makeAddr("user2");

    bytes32 public marketId = keccak256("WETH/USDC Market");
    uint256 public constant ROUND_DURATION = 1 days;

    function setUp() public {
        weth = new MockERC20("Wrapped Ether", "WETH", 18);
        morpho = new MockMorpho(address(weth));
        psl = new PumpkinSpiceLatte(address(weth), address(morpho), marketId, ROUND_DURATION);

        // Mint some WETH for users
        weth._mint(user1, 100 ether);
        weth._mint(user2, 100 ether);
    }

    function testDeposit() public {
        vm.startPrank(user1);
        weth.approve(address(psl), 10 ether);
        psl.deposit(10 ether);
        vm.stopPrank();

        assertEq(psl.balanceOf(user1), 10 ether, "User1 balance should be 10 ether");
        assertEq(psl.totalPrincipal(), 10 ether, "Total principal should be 10 ether");
        assertEq(psl.depositors(0), user1, "User1 should be in depositors array");
        assertEq(morpho.suppliedAssets(marketId), 10 ether, "Assets should be supplied to Morpho");
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
        assertEq(morpho.suppliedAssets(marketId), 7 ether, "Morpho assets should be reduced");
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
        
        // Simulate yield from Morpho by just sending WETH to the contract
        weth._mint(address(morpho), 1 ether);
        
        // Fast forward time to the next round
        vm.warp(block.timestamp + ROUND_DURATION + 1);

        // Award the prize
        psl.awardPrize();

        address winner = psl.lastWinner();
        uint256 prizeAmount = psl.lastPrizeAmount();
        
        assertTrue(winner == user1 || winner == user2, "Winner should be user1 or user2");
        assertApproxEqAbs(prizeAmount, 1 ether, 1, "Prize amount should be ~1 ether");
        assertEq(weth.balanceOf(winner), 90 ether + prizeAmount, "Winner should receive the prize");
        assertEq(psl.nextRoundTimestamp(), block.timestamp + ROUND_DURATION, "Next round timestamp should be reset");
    }
}
