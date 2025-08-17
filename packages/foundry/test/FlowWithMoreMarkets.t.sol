// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
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

// Testable versions of Flow adapters for testing
contract TestableFlowRandomAdapter256 is IRandomnessProvider {
    address public cadenceArch;

    constructor(address _cadenceArch) {
        cadenceArch = _cadenceArch;
    }

    function randomUint256(bytes32 salt) external view returns (uint256) {
        // Get multiple random numbers from Cadence Arch to increase entropy
        uint64 random1 = _getRevertibleRandom();
        uint64 random2 = _getRevertibleRandom();
        uint64 random3 = _getRevertibleRandom();
        uint64 random4 = _getRevertibleRandom();
        
        // Combine multiple random numbers with salt and block context for maximum entropy
        return uint256(keccak256(abi.encodePacked(
            random1, random2, random3, random4, 
            salt, 
            block.timestamp, 
            block.prevrandao
        )));
    }

    function _getRevertibleRandom() internal view returns (uint64) {
        (bool ok, bytes memory data) = cadenceArch.staticcall(
            abi.encodeWithSignature("revertibleRandom()")
        );
        
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

contract TestableFlowRandomAdapter64 is IRandomnessProvider {
    address public cadenceArch;

    constructor(address _cadenceArch) {
        cadenceArch = _cadenceArch;
    }

    function randomUint256(bytes32 salt) external view returns (uint256) {
        uint64 randomNumber = _getRevertibleRandom();
        
        return uint256(keccak256(abi.encodePacked(
            randomNumber, 
            salt, 
            block.timestamp
        )));
    }

    function _getRevertibleRandom() internal view returns (uint64) {
        (bool ok, bytes memory data) = cadenceArch.staticcall(
            abi.encodeWithSignature("revertibleRandom()")
        );
        
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
    uint256 public constant ROUND_DURATION = 300; // 5 minutes

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
        psl = new PumpkinSpiceLatte(
            address(moreMarketsAdapter),
            address(flowRandom256),
            ROUND_DURATION
        );
        
        // Test deposit functionality
        vm.startPrank(user1);
        mockToken.approve(address(psl), DEPOSIT_AMOUNT);
        psl.deposit(DEPOSIT_AMOUNT);
        vm.stopPrank();
        
        assertEq(psl.balanceOf(user1), DEPOSIT_AMOUNT, "User1 balance should match deposit");
        assertEq(psl.totalPrincipal(), DEPOSIT_AMOUNT, "Total principal should match deposit");
        
        // Test deposit from another user
        vm.startPrank(user2);
        mockToken.approve(address(psl), DEPOSIT_AMOUNT);
        psl.deposit(DEPOSIT_AMOUNT);
        vm.stopPrank();
        
        assertEq(psl.balanceOf(user2), DEPOSIT_AMOUNT, "User2 balance should match deposit");
        assertEq(psl.totalPrincipal(), DEPOSIT_AMOUNT * 2, "Total principal should match both deposits");
        assertEq(psl.numberOfDepositors(), 2, "Should have 2 depositors");
        
        // Simulate yield generation by changing exchange rate
        mockMarket.setExchangeRate(1.1e18); // 10% yield
        
        // Simulate time passing and award prize
        vm.warp(block.timestamp + ROUND_DURATION + 1);
        
        // Mock the random number for predictable testing
        mockCadenceArch.setMockValues(987654321, false);
        
        // Award prize (this will use Flow randomness)
        psl.awardPrize();
        
        // Verify prize was awarded
        assertTrue(psl.lastWinner() == user1 || psl.lastWinner() == user2, "Prize should be awarded to one of the depositors");
        assertTrue(psl.lastPrizeAmount() > 0, "Prize amount should be greater than 0");
    }

    function testFlowRandom64WithMoreMarkets() public {
        // Deploy Pumpkin Spice Latte with Flow 64-bit randomness and MoreMarkets
        psl = new PumpkinSpiceLatte(
            address(moreMarketsAdapter),
            address(flowRandom64),
            ROUND_DURATION
        );
        
        // Test deposit functionality
        vm.startPrank(user1);
        mockToken.approve(address(psl), DEPOSIT_AMOUNT);
        psl.deposit(DEPOSIT_AMOUNT);
        vm.stopPrank();
        
        // Test deposit from another user
        vm.startPrank(user2);
        mockToken.approve(address(psl), DEPOSIT_AMOUNT);
        psl.deposit(DEPOSIT_AMOUNT);
        vm.stopPrank();
        
        // Simulate yield generation by changing exchange rate
        mockMarket.setExchangeRate(1.1e18); // 10% yield
        
        // Simulate time passing and award prize
        vm.warp(block.timestamp + ROUND_DURATION + 1);
        
        // Mock the random number for predictable testing
        mockCadenceArch.setMockValues(555666777, false);
        
        // Award prize (this will use Flow randomness)
        psl.awardPrize();
        
        // Verify prize was awarded
        assertTrue(psl.lastWinner() == user1 || psl.lastWinner() == user2, "Prize should be awarded to one of the depositors");
        assertTrue(psl.lastPrizeAmount() > 0, "Prize amount should be greater than 0");
    }

    function testMoreMarketsAdapterIntegration() public {
        // Test that MoreMarkets adapter works correctly with Flow randomness
        psl = new PumpkinSpiceLatte(
            address(moreMarketsAdapter),
            address(flowRandom256),
            ROUND_DURATION
        );
        
        // Test deposit and withdrawal cycle
        vm.startPrank(user1);
        mockToken.approve(address(psl), DEPOSIT_AMOUNT);
        psl.deposit(DEPOSIT_AMOUNT);
        
        // Simulate some yield generation by changing exchange rate
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
            address(moreMarketsAdapter),
            address(flowRandom256),
            ROUND_DURATION
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
        
        // Simulate yield generation by changing exchange rate
        mockMarket.setExchangeRate(1.1e18); // 10% yield
        
        // Simulate time passing
        vm.warp(block.timestamp + ROUND_DURATION + 1);
        
        // Test with different random seeds
        mockCadenceArch.setMockValues(111111111, false);
        psl.awardPrize();
        address winner1 = psl.lastWinner();
        uint256 prize1 = psl.lastPrizeAmount();
        
        // Reset and test with different seed - need to generate more yield
        mockMarket.setExchangeRate(1.2e18); // 20% yield for second round
        vm.warp(block.timestamp + ROUND_DURATION + 1);
        mockCadenceArch.setMockValues(222222222, false);
        psl.awardPrize();
        address winner2 = psl.lastWinner();
        uint256 prize2 = psl.lastPrizeAmount();
        
        // Verify randomness produces different results
        assertTrue(winner1 != winner2 || prize1 != prize2, "Different random seeds should produce different results");
    }

    function testErrorHandling() public {
        // Test error handling when Cadence Arch fails
        psl = new PumpkinSpiceLatte(
            address(moreMarketsAdapter),
            address(flowRandom256),
            ROUND_DURATION
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
        
        // Simulate time passing
        vm.warp(block.timestamp + ROUND_DURATION + 1);
        
        // Simulate yield generation by changing exchange rate
        mockMarket.setExchangeRate(1.1e18); // 10% yield
        
        // Simulate time passing
        vm.warp(block.timestamp + ROUND_DURATION + 1);
        
        // Make Cadence Arch revert
        mockCadenceArch.setMockValues(0, true);
        
        // Prize awarding should revert
        vm.expectRevert("Mock Cadence Arch revert");
        psl.awardPrize();
    }
}
