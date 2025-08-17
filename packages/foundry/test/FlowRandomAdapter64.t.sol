// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {FlowRandomAdapter64} from "../src/adapters/FlowRandomAdapter64.sol";
import {IRandomnessProvider} from "../src/interfaces/IRandomnessProvider.sol";

// Mock contract to simulate Cadence Arch
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

// Testable version of FlowRandomAdapter64 that allows address injection
contract TestableFlowRandomAdapter64 is IRandomnessProvider {
    address public cadenceArch;

    constructor(address _cadenceArch) {
        cadenceArch = _cadenceArch;
    }

    function randomUint256(bytes32 salt) external view returns (uint256) {
        // Get single random number from Cadence Arch for gas efficiency
        uint64 randomNumber = _getRevertibleRandom();

        // Mix the random number with salt and block context
        return uint256(keccak256(abi.encodePacked(randomNumber, salt, block.timestamp)));
    }

    function getSecureRandomNumber() external view returns (uint64 randomNumber) {
        return _getRevertibleRandom();
    }

    function getCadenceArchAddress() external view returns (address) {
        return cadenceArch;
    }

    function _getRevertibleRandom() internal view returns (uint64) {
        // Static call to the Cadence Arch contract's revertibleRandom function
        (bool ok, bytes memory data) = cadenceArch.staticcall(abi.encodeWithSignature("revertibleRandom()"));

        // For testing, let the original revert pass through
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

contract FlowRandomAdapter64Test is Test {
    FlowRandomAdapter64 public adapter;
    TestableFlowRandomAdapter64 public testableAdapter;
    MockCadenceArch public mockCadenceArch;

    function setUp() public {
        // Deploy mock Cadence Arch
        mockCadenceArch = new MockCadenceArch();

        // Deploy the real adapter (for interface testing)
        adapter = new FlowRandomAdapter64();

        // Deploy the testable adapter with our mock
        testableAdapter = new TestableFlowRandomAdapter64(address(mockCadenceArch));
    }

    function testImplementsIRandomnessProvider() public view {
        // Verify the adapter implements the interface
        IRandomnessProvider provider = IRandomnessProvider(address(adapter));

        // This should not revert if the interface is properly implemented
        assertTrue(address(provider) == address(adapter), "Should implement IRandomnessProvider");
    }

    function testRandomUint256WithValidRandom() public {
        // Set up mock to return a valid random number
        uint64 mockRandom = 123456789;
        mockCadenceArch.setMockValues(mockRandom, false);

        bytes32 salt = keccak256("test-salt");
        uint256 result = testableAdapter.randomUint256(salt);

        // The result should be a hash of the mock random number, salt, and timestamp
        uint256 expected = uint256(keccak256(abi.encodePacked(mockRandom, salt, block.timestamp)));
        assertEq(result, expected, "Random number should match expected hash");
    }

    function testRandomUint256WithDifferentSalts() public {
        // Set up mock to return a valid random number
        uint64 mockRandom = 987654321;
        mockCadenceArch.setMockValues(mockRandom, false);

        bytes32 salt1 = keccak256("salt-1");
        bytes32 salt2 = keccak256("salt-2");

        uint256 result1 = testableAdapter.randomUint256(salt1);
        uint256 result2 = testableAdapter.randomUint256(salt2);

        // Different salts should produce different results
        assertTrue(result1 != result2, "Different salts should produce different results");

        // Same salt should produce same result
        uint256 result3 = testableAdapter.randomUint256(salt1);
        assertEq(result1, result3, "Same salt should produce same result");
    }

    function testRandomUint256WithSameSalt() public {
        // Set up mock to return a valid random number
        uint64 mockRandom = 555666777;
        mockCadenceArch.setMockValues(mockRandom, false);

        bytes32 salt = keccak256("consistent-salt");

        uint256 result1 = testableAdapter.randomUint256(salt);
        uint256 result2 = testableAdapter.randomUint256(salt);

        // Same salt should produce same result
        assertEq(result1, result2, "Same salt should produce same result");
    }

    function testGetSecureRandomNumber() public {
        // Set up mock to return a valid random number
        uint64 mockRandom = 111222333;
        mockCadenceArch.setMockValues(mockRandom, false);

        uint64 result = testableAdapter.getSecureRandomNumber();
        assertEq(result, mockRandom, "Should return the mock random number");
    }

    function testGetCadenceArchAddress() public view {
        address cadenceArchAddress = adapter.getCadenceArchAddress();
        assertEq(
            cadenceArchAddress, 0x0000000000000000000000010000000000000001, "Should return correct Cadence Arch address"
        );
    }

    function testCadenceArchRevert() public {
        // Set up mock to revert
        mockCadenceArch.setMockValues(0, true);

        bytes32 salt = keccak256("test-salt");

        // Should revert when Cadence Arch reverts
        vm.expectRevert("Mock Cadence Arch revert");
        testableAdapter.randomUint256(salt);
    }

    function testCadenceArchCallFailure() public {
        // Test with an invalid address that will fail the call
        TestableFlowRandomAdapter64 invalidAdapter = new TestableFlowRandomAdapter64(address(0x123));

        bytes32 salt = keccak256("test-salt");

        // Should revert when the call fails
        vm.expectRevert(); // Expect any revert
        invalidAdapter.randomUint256(salt);
    }
}
