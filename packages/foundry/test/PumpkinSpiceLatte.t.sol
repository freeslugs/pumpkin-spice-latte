// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {PumpkinSpiceLatte} from "../src/PumpkinSpiceLatte.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {VRFConsumerBaseV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";

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

// Minimal VRF Coordinator mock compatible with V2.5 interfaces
contract MinimalVRFCoordinatorV2_5Mock {
    struct Request {
        uint256 subId;
        uint32 callbackGasLimit;
        uint32 numWords;
        address sender;
    }

    uint256 internal _nextSubId = 1;
    uint256 internal _nextRequestId = 1;
    mapping(uint256 => Request) internal _requests; // requestId => Request

    function createSubscription() external returns (uint256 subId) {
        subId = _nextSubId++;
    }

    function addConsumer(uint256 /*subId*/, address /*consumer*/) external {}
    function removeConsumer(uint256, address) external {}
    function cancelSubscription(uint256, address) external {}
    function pendingRequestExists(uint256) external pure returns (bool) { return false; }

    function requestRandomWords(
        VRFV2PlusClient.RandomWordsRequest calldata req
    ) external returns (uint256 requestId) {
        requestId = _nextRequestId++;
        _requests[requestId] = Request({
            subId: req.subId,
            callbackGasLimit: req.callbackGasLimit,
            numWords: req.numWords,
            sender: msg.sender
        });
    }

    // Test helper to fulfill with controlled words
    function fulfillRandomWordsWithOverride(
        uint256 requestId,
        address consumer,
        uint256[] memory words
    ) external {
        Request memory r = _requests[requestId];
        require(r.numWords == words.length || words.length == 0, "bad words len");
        if (words.length == 0) {
            words = new uint256[](r.numWords);
            for (uint256 i = 0; i < r.numWords; i++) {
                words[i] = uint256(keccak256(abi.encode(requestId, i)));
            }
        }
        VRFConsumerBaseV2Plus v;
        bytes memory callReq = abi.encodeWithSelector(v.rawFulfillRandomWords.selector, requestId, words);
        // call with provided gas limit
        (bool ok, ) = consumer.call{gas: r.callbackGasLimit}(callReq);
        require(ok, "fulfill failed");
        delete _requests[requestId];
    }

    // No-op stubs for subscription management used in tests
}

//-//////////////////////////////////////////////////////////
//                           TESTS
//-//////////////////////////////////////////////////////////

contract PumpkinSpiceLatteTest is Test {
    PumpkinSpiceLatte public psl;
    MockERC20 public weth;
    MockVault public vault;
    MinimalVRFCoordinatorV2_5Mock public vrf;

    address public user1 = makeAddr("user1");
    address public user2 = makeAddr("user2");

    // VRF params (mock)
    bytes32 internal constant KEY_HASH = bytes32(uint256(1));
    uint32 internal constant CALLBACK_GAS_LIMIT = 500000;
    uint16 internal constant REQUEST_CONFIRMATIONS = 1;
    uint256 internal subId;

    function setUp() public {
        weth = new MockERC20("Wrapped Ether", "WETH", 18);
        vault = new MockVault(address(weth));

        // Deploy minimal VRF coordinator mock
        vrf = new MinimalVRFCoordinatorV2_5Mock();
        subId = vrf.createSubscription();

        psl = new PumpkinSpiceLatte(
            address(weth),
            address(vault),
            address(vrf),
            KEY_HASH,
            subId,
            CALLBACK_GAS_LIMIT,
            REQUEST_CONFIRMATIONS,
            10,      // baseThreshold
            20,      // maxThreshold
            7 days,  // timeToMaxThreshold
            1 hours  // drawCooldown
        );
        vrf.addConsumer(subId, address(psl));

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
        
        // Trigger VRF request
        psl.awardPrize();
        // lastDrawingTimestamp should update
        assertEq(psl.lastDrawingTimestamp(), block.timestamp, "lastDrawingTimestamp updated");
        // Fulfill with a random word intended to be below the current threshold
        uint256[] memory words = new uint256[](1);
        words[0] = 5;
        vrf.fulfillRandomWordsWithOverride(psl.lastRequestId(), address(psl), words);

        address winner = psl.lastWinner();
        uint256 prizeAmount = psl.lastPrizeAmount();

        assertTrue(winner == user1 || winner == user2, "Winner should be user1 or user2");
        assertApproxEqAbs(prizeAmount, 1 ether, 1, "Prize amount should be ~1 ether");
        // With new accounting, no tokens are withdrawn to the winner. Their external balance remains unchanged.
        assertEq(weth.balanceOf(winner), 90 ether, "Winner's external token balance should be unchanged");
        // Winner's principal balance is credited with the prize
        assertEq(psl.balanceOf(winner), 10 ether + prizeAmount, "Winner's principal should increase by prize");
        // Ensure lastPrizeTimestamp updated on success
        assertEq(psl.lastPrizeTimestamp(), block.timestamp, "lastPrizeTimestamp should update on payout");
        // Principal remains fully represented in totalAssets
        assertEq(psl.totalAssets(), psl.totalPrincipal(), "Principal should remain supplied after prize");
    }

    function testAwardPrize_NoAwardWhenD100AboveThreshold() public {
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

        // Trigger VRF request
        psl.awardPrize();
        // Fulfill with a random word that makes d100 above the current threshold
        uint256[] memory words = new uint256[](1);
        words[0] = 50;
        vrf.fulfillRandomWordsWithOverride(psl.lastRequestId(), address(psl), words);

        // No updates expected on no-award path
        assertEq(psl.lastWinner(), address(0), "No winner expected");
        assertEq(psl.lastPrizeAmount(), 0, "No prize expected");
    }
}
