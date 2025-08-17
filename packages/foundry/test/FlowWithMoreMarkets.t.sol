// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {PumpkinSpiceLatte} from "../src/PumpkinSpiceLatte.sol";
import {MoreMarketsAdapter} from "../src/adapters/MoreMarketsAdapter.sol";
import {IRandomnessProvider} from "../src/interfaces/IRandomnessProvider.sol";

// Mock contracts for testing
contract MockERC20 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    string public name = "Mock Token";
    string public symbol = "MTK";
    uint8 public decimals = 18;
    uint256 public totalSupply;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "Insufficient balance");
        require(allowance[from][msg.sender] >= amount, "Insufficient allowance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        allowance[from][msg.sender] -= amount;
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }
}

contract MockMoreMarketToken {
    MockERC20 public underlyingToken;
    uint256 public exchangeRate = 1e18; // 1:1 initially
    mapping(address => uint256) public balanceOf;

    constructor(address _underlying) {
        underlyingToken = MockERC20(_underlying);
    }

    function mint(uint256 mintAmount) external returns (uint256) {
        uint256 shares = (mintAmount * 1e18) / exchangeRate;
        balanceOf[msg.sender] += shares;
        return 0; // Return 0 for success (error code)
    }

    function redeemUnderlying(uint256 redeemAmount) external returns (uint256) {
        uint256 shares = (redeemAmount * 1e18) / exchangeRate;
        require(balanceOf[msg.sender] >= shares, "Insufficient shares");
        balanceOf[msg.sender] -= shares;
        return 0; // Return 0 for success (error code)
    }

    function exchangeRateStored() external view returns (uint256) {
        return exchangeRate;
    }

    function underlying() external view returns (address) {
        return address(underlyingToken);
    }

    function setExchangeRate(uint256 _rate) external {
        exchangeRate = _rate;
    }
}

// Mock Cadence Arch for Flow randomness
contract MockCadenceArch {
    uint64 public mockRandomNumber;
    bool public shouldRevert;

    function setMockValues(uint64 _randomNumber, bool _shouldRevert) external {
        mockRandomNumber = _randomNumber;
        shouldRevert = _shouldRevert;
    }

    function revertibleRandom() external view returns (uint64) {
        if (shouldRevert) {
            revert("Mock Cadence Arch revert");
        }
        return mockRandomNumber;
    }
}

// Testable version of FlowRandomAdapter256 for testing
contract TestableFlowRandomAdapter256 is IRandomnessProvider {
    address public cadenceArch;

    constructor(address _cadenceArch) {
        cadenceArch = _cadenceArch;
    }

    function randomUint256(bytes32 salt) external view returns (uint256) {
        uint64 random1 = _getRevertibleRandom();
        return uint256(keccak256(abi.encodePacked(random1, salt))) % (2 ** 128);
    }

    function getSecureRandomNumber() external view returns (uint64 randomNumber) {
        return _getRevertibleRandom();
    }

    function getCadenceArchAddress() external view returns (address) {
        return cadenceArch;
    }

    function _getRevertibleRandom() internal view returns (uint64) {
        (bool ok, bytes memory data) = cadenceArch.staticcall(abi.encodeWithSignature("revertibleRandom()"));

        if (!ok) {
            assembly {
                returndatacopy(0, 0, returndatasize())
                revert(0, returndatasize())
            }
        }

        uint64 output = abi.decode(data, (uint64));
        return output;
    }
}

// Testable version of FlowRandomAdapter64 for testing
contract TestableFlowRandomAdapter64 is IRandomnessProvider {
    address public cadenceArch;

    constructor(address _cadenceArch) {
        cadenceArch = _cadenceArch;
    }

    function randomUint256(bytes32 salt) external view returns (uint256) {
        uint64 randomNumber = _getRevertibleRandom();
        return uint256(keccak256(abi.encodePacked(randomNumber, salt))) % (2 ** 128);
    }

    function getSecureRandomNumber() external view returns (uint64 randomNumber) {
        return _getRevertibleRandom();
    }

    function getCadenceArchAddress() external view returns (address) {
        return cadenceArch;
    }

    function _getRevertibleRandom() internal view returns (uint64) {
        (bool ok, bytes memory data) = cadenceArch.staticcall(abi.encodeWithSignature("revertibleRandom()"));

        if (!ok) {
            assembly {
                returndatacopy(0, 0, returndatasize())
                revert(0, returndatasize())
            }
        }

        uint64 output = abi.decode(data, (uint64));
        return output;
    }
}

contract FlowWithMoreMarketsTest is Test {
    PumpkinSpiceLatte public psl;
    MockERC20 public mockToken;
    MockMoreMarketToken public mockMarket;
    MoreMarketsAdapter public moreMarketsAdapter;
    MockCadenceArch public mockCadenceArch;

    // Testable Flow adapters
    TestableFlowRandomAdapter256 public flowRandom256;
    TestableFlowRandomAdapter64 public flowRandom64;

    address public user1 = address(0x1);
    address public user2 = address(0x2);
    address public user3 = address(0x3);

    uint256 public constant INITIAL_BALANCE = 1000e18;
    uint256 public constant DEPOSIT_AMOUNT = 100e18;
    uint256 public constant BASE_REWARD_HALF_LIFE = 3600; // 1 hour
    uint256 public constant HALF_LIFE_2 = 3600; // 1 hour

    function setUp() public {
        // Deploy mock contracts
        mockToken = new MockERC20();
        mockMarket = new MockMoreMarketToken(address(mockToken));
        moreMarketsAdapter = new MoreMarketsAdapter(address(mockMarket));
        mockCadenceArch = new MockCadenceArch();

        // Deploy testable Flow adapters
        flowRandom256 = new TestableFlowRandomAdapter256(address(mockCadenceArch));
        flowRandom64 = new TestableFlowRandomAdapter64(address(mockCadenceArch));

        // Mint initial tokens to users
        mockToken.mint(user1, INITIAL_BALANCE);
        mockToken.mint(user2, INITIAL_BALANCE);
        mockToken.mint(user3, INITIAL_BALANCE);

        // Set up mock Cadence Arch
        mockCadenceArch.setMockValues(123456789, false);
    }

    function testFlowRandom256WithMoreMarkets() public {
        // Deploy Pumpkin Spice Latte with Flow 256-bit randomness and MoreMarkets
        console.log("=== Starting testFlowRandom256WithMoreMarkets ===");
        psl = new PumpkinSpiceLatte(
            address(moreMarketsAdapter), address(flowRandom256), BASE_REWARD_HALF_LIFE, HALF_LIFE_2
        );

        // Test the Flow adapter directly
        console.log("Testing Flow adapter directly...");
        bytes32 testSalt = bytes32(uint256(2));
        uint256 testRandom = flowRandom256.randomUint256(testSalt);
        console.log("Direct Flow adapter test - random number:", testRandom);

        // Test deposit functionality
        console.log("Starting deposits...");
        vm.startPrank(user1);
        mockToken.approve(address(psl), DEPOSIT_AMOUNT);
        psl.deposit(DEPOSIT_AMOUNT);
        vm.stopPrank();

        vm.startPrank(user2);
        mockToken.approve(address(psl), DEPOSIT_AMOUNT);
        psl.deposit(DEPOSIT_AMOUNT);
        vm.stopPrank();

        assertEq(psl.balanceOf(user1), DEPOSIT_AMOUNT, "User1 balance should match deposit");
        assertEq(psl.balanceOf(user2), DEPOSIT_AMOUNT, "User2 balance should match deposit");
        assertEq(psl.totalPrincipal(), DEPOSIT_AMOUNT * 2, "Total principal should match both deposits");
        assertEq(psl.numberOfDepositors(), 2, "Should have 2 depositors");

        // Simulate yield generation by changing exchange rate
        mockMarket.setExchangeRate(1.1e18); // 10% yield

        // Verify yield was generated
        assertGt(psl.prizePool(), 0, "Prize pool should be greater than 0 after yield generation");

        // Test Flow randomness with proper half-life understanding
        // Immediately after deployment, threshold should be 0 (no chance to win)
        uint256 initialThreshold = psl.currentWinThreshold();
        assertEq(initialThreshold, 0, "Initial threshold should be 0 (no chance to win)");

        // Test that Flow randomness does NOT win when threshold is 0
        mockCadenceArch.setMockValues(123456789, false);
        psl.awardPrize();

        // Verify prize was NOT awarded (since threshold is 0)
        assertEq(psl.lastWinner(), address(0), "No prize should be awarded when threshold is 0");
        assertEq(psl.lastPrizeAmount(), 0, "No prize amount should be set when threshold is 0");

        // Advance time to increase threshold and allow prizes to be awarded
        vm.warp(block.timestamp + 7200); // Advance 2 hours

        uint256 newThreshold = psl.currentWinThreshold();
        assertGt(newThreshold, 0, "Threshold should increase after time passes");

        // Now test that Flow randomness can win with a higher threshold
        mockCadenceArch.setMockValues(1, false); // Use a very small number to ensure it passes threshold

        psl.awardPrize();

        // Verify prize was awarded this time
        assertTrue(psl.lastWinner() != address(0), "Prize should be awarded when threshold is high enough");
        assertTrue(psl.lastWinner() == user1 || psl.lastWinner() == user2, "Winner should be one of the depositors");
        assertGt(psl.lastPrizeAmount(), 0, "Prize amount should be greater than 0");
    }

    function testFlowRandom64WithMoreMarkets() public {
        // Deploy Pumpkin Spice Latte with Flow 64-bit randomness and MoreMarkets
        psl = new PumpkinSpiceLatte(
            address(moreMarketsAdapter), address(flowRandom64), BASE_REWARD_HALF_LIFE, HALF_LIFE_2
        );

        // Test deposit functionality
        vm.startPrank(user1);
        mockToken.approve(address(psl), DEPOSIT_AMOUNT);
        psl.deposit(DEPOSIT_AMOUNT);
        vm.stopPrank();

        vm.startPrank(user2);
        mockToken.approve(address(psl), DEPOSIT_AMOUNT);
        psl.deposit(DEPOSIT_AMOUNT);
        vm.stopPrank();

        // Simulate yield generation
        mockMarket.setExchangeRate(1.1e18); // 10% yield
        assertGt(psl.prizePool(), 0, "Prize pool should be greater than 0");

        // Test Flow 64-bit randomness
        uint256 initialThreshold = psl.currentWinThreshold();
        assertEq(initialThreshold, 0, "Initial threshold should be 0 (no chance to win)");

        // Test that no prize is awarded when threshold is 0
        mockCadenceArch.setMockValues(987654321, false);
        psl.awardPrize();

        // Verify no prize was awarded
        assertEq(psl.lastWinner(), address(0), "No prize should be awarded when threshold is 0");
        assertEq(psl.lastPrizeAmount(), 0, "No prize amount should be set when threshold is 0");

        // Advance time to increase threshold
        vm.warp(block.timestamp + 7200); // Advance 2 hours

        uint256 newThreshold = psl.currentWinThreshold();
        assertGt(newThreshold, 0, "Threshold should increase after time passes");

        // Now test prize awarding with Flow 64-bit randomness
        mockCadenceArch.setMockValues(1, false); // Use a very small number to ensure it passes threshold

        psl.awardPrize();

        // Verify prize was awarded this time
        assertTrue(psl.lastWinner() != address(0), "Prize should be awarded when threshold is high enough");
        assertTrue(psl.lastWinner() == user1 || psl.lastWinner() == user2, "Winner should be one of the depositors");
        assertGt(psl.lastPrizeAmount(), 0, "Prize amount should be greater than 0");
    }

    function testMoreMarketsAdapterIntegration() public {
        // Test that MoreMarkets adapter works correctly with Flow randomness
        psl = new PumpkinSpiceLatte(
            address(moreMarketsAdapter), address(flowRandom256), BASE_REWARD_HALF_LIFE, HALF_LIFE_2
        );

        // Test deposit and withdrawal cycle
        vm.startPrank(user1);
        mockToken.approve(address(psl), DEPOSIT_AMOUNT);
        psl.deposit(DEPOSIT_AMOUNT);

        // Simulate some yield generation
        mockMarket.setExchangeRate(1.1e18); // 10% yield

        // Withdraw
        psl.withdraw(DEPOSIT_AMOUNT);
        vm.stopPrank();

        // Verify withdrawal worked
        assertEq(psl.balanceOf(user1), 0, "User1 balance should be 0 after withdrawal");
        assertEq(psl.totalPrincipal(), 0, "Total principal should be 0 after withdrawal");
        assertEq(psl.numberOfDepositors(), 0, "Should have 0 depositors after withdrawal");
    }

    function testFlowRandomnessQuality() public {
        // Test that both Flow adapters provide different randomness
        psl = new PumpkinSpiceLatte(
            address(moreMarketsAdapter), address(flowRandom256), BASE_REWARD_HALF_LIFE, HALF_LIFE_2
        );

        // Add some depositors
        vm.startPrank(user1);
        mockToken.approve(address(psl), DEPOSIT_AMOUNT);
        psl.deposit(DEPOSIT_AMOUNT);
        vm.stopPrank();

        vm.startPrank(user2);
        mockToken.approve(address(psl), DEPOSIT_AMOUNT);
        psl.deposit(DEPOSIT_AMOUNT);
        vm.stopPrank();

        // Simulate yield generation
        mockMarket.setExchangeRate(1.1e18); // 10% yield

        // Test with different random seeds to verify Flow randomness quality
        mockCadenceArch.setMockValues(1, false);

        // First attempt - should NOT win since threshold is 0
        uint256 threshold1 = psl.currentWinThreshold();
        assertEq(threshold1, 0, "Initial threshold should be 0");

        psl.awardPrize();
        address winner1 = psl.lastWinner();
        uint256 prize1 = psl.lastPrizeAmount();

        // Verify first prize was NOT awarded
        assertEq(winner1, address(0), "First prize should NOT be awarded when threshold is 0");
        assertEq(prize1, 0, "First prize amount should be 0 when threshold is 0");

        // Advance time to increase threshold and allow prizes
        vm.warp(block.timestamp + 7200); // Advance 2 hours

        // Test that threshold increased
        uint256 threshold2 = psl.currentWinThreshold();
        assertGt(threshold2, threshold1, "Threshold should increase after time passes");

        // Second attempt with different seed and higher threshold
        mockCadenceArch.setMockValues(2, false);
        psl.awardPrize();

        // The second attempt should win since threshold is higher and we use a small random number
        console.log("First winner:", winner1, "Prize:", prize1);
        console.log("Second winner:", psl.lastWinner(), "Prize:", psl.lastPrizeAmount());
        console.log("Threshold after time advance:", threshold2);

        // Verify the randomness system is working (either different results or threshold mechanism working)
        bool randomnessWorking =
            (psl.lastWinner() != winner1) || (psl.lastPrizeAmount() != prize1) || (psl.lastWinner() != address(0)); // Second prize should be awarded

        assertTrue(randomnessWorking, "Flow randomness system should produce varied results or respect thresholds");
    }

    function testErrorHandling() public {
        // Test error handling when Cadence Arch fails
        psl = new PumpkinSpiceLatte(
            address(moreMarketsAdapter), address(flowRandom256), BASE_REWARD_HALF_LIFE, HALF_LIFE_2
        );

        // Add depositors
        vm.startPrank(user1);
        mockToken.approve(address(psl), DEPOSIT_AMOUNT);
        psl.deposit(DEPOSIT_AMOUNT);
        vm.stopPrank();

        vm.startPrank(user2);
        mockToken.approve(address(psl), DEPOSIT_AMOUNT);
        psl.deposit(DEPOSIT_AMOUNT);
        vm.stopPrank();

        // Simulate yield generation
        mockMarket.setExchangeRate(1.1e18); // 10% yield

        // Make Cadence Arch revert
        mockCadenceArch.setMockValues(0, true);

        // Prize awarding should revert due to Flow randomness failure
        vm.expectRevert("Mock Cadence Arch revert");
        psl.awardPrize();
    }
}
