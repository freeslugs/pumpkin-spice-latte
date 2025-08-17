import React from 'react';
import { useReadContract, useAccount } from 'wagmi';
import {
  pumpkinSpiceLatteAddress,
  pumpkinSpiceLatteAbi,
  CONTRACTS,
} from '../contracts/PumpkinSpiceLatte';
import { formatUnits } from 'viem';
import { ArrowLeft, User, Wallet, Award, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Profile = () => {
  const navigate = useNavigate();
  const { isConnected, chain, address } = useAccount();

  // Check if we're on a supported network
  const isSupportedNetwork =
    chain && CONTRACTS[chain.id as keyof typeof CONTRACTS];
  const targetChainId = isSupportedNetwork ? chain!.id : 1;
  const contractAddress =
    CONTRACTS[targetChainId as keyof typeof CONTRACTS]?.pumpkinSpiceLatte ??
    pumpkinSpiceLatteAddress;

  const { data: userBalanceData } = useReadContract({
    address: contractAddress,
    abi: pumpkinSpiceLatteAbi,
    functionName: 'balanceOf',
    chainId: targetChainId,
    args: [address as `0x${string}`],
    query: {
      refetchInterval: 30000,
      enabled: isConnected && !!address,
    },
  });

  const { data: totalAssetsData } = useReadContract({
    address: contractAddress,
    abi: pumpkinSpiceLatteAbi,
    functionName: 'totalAssets',
    chainId: targetChainId,
    query: {
      refetchInterval: 30000,
      enabled: true,
    },
  });

  const { data: totalPrincipalData } = useReadContract({
    address: contractAddress,
    abi: pumpkinSpiceLatteAbi,
    functionName: 'totalPrincipal',
    chainId: targetChainId,
    query: {
      refetchInterval: 30000,
      enabled: true,
    },
  });

  const userBalance = userBalanceData
    ? parseFloat(formatUnits(userBalanceData as bigint, 6))
    : 0;
  const totalAssets = totalAssetsData
    ? parseFloat(formatUnits(totalAssetsData as bigint, 6))
    : 0;
  const totalPrincipal = totalPrincipalData
    ? parseFloat(formatUnits(totalPrincipalData as bigint, 6))
    : 0;

  // Calculate user's share of the total yield
  const userYield =
    totalPrincipal > 0
      ? (userBalance / totalPrincipal) * (totalAssets - totalPrincipal)
      : 0;

  return (
    <div className='p-4 space-y-6'>
      {/* User Profile Information */}
      <div className='space-y-4'>
        <div className='bg-white p-6 rounded-xl border border-[#f5f2f0]'>
          <div className='flex items-center gap-3 mb-4'>
            <span className='text-3xl'>👤</span>
            <div>
              <h3 className='text-lg font-bold text-[#181411]'>
                Profile Information
              </h3>
              <p className='text-sm text-muted-foreground'>
                Your account details
              </p>
            </div>
          </div>

          <div className='space-y-3'>
            <div className='flex justify-between items-center p-3 bg-gray-50 rounded-lg'>
              <span className='text-sm text-gray-600'>Wallet Address</span>
              <span className='font-mono text-sm font-medium text-gray-900'>
                {address
                  ? `${address.slice(0, 6)}...${address.slice(-4)}`
                  : 'Not connected'}
              </span>
            </div>

            <div className='flex justify-between items-center p-3 bg-gray-50 rounded-lg'>
              <span className='text-sm text-gray-600'>Total Balance</span>
              <span className='font-bold text-gray-900'>
                {userBalance} USDC
              </span>
            </div>

            <div className='flex justify-between items-center p-3 bg-gray-50 rounded-lg'>
              <span className='text-sm text-gray-600'>Generated Yield</span>
              <span className='font-bold text-green-600'>
                {userYield.toFixed(2)} USDC
              </span>
            </div>

            <div className='flex justify-between items-center p-3 bg-gray-50 rounded-lg'>
              <span className='text-sm text-gray-600'>Principal Deposited</span>
              <span className='font-bold text-gray-900'>
                {userBalance} USDC
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Network Status */}
      {!isSupportedNetwork && (
        <div className='bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-lg'>
          <div className='flex items-center gap-2'>
            <span className='text-lg'>⚠️</span>
            <span className='font-medium'>Network not supported</span>
          </div>
          <p className='text-sm mt-1'>
            Please switch to a supported network to view your profile.
          </p>
        </div>
      )}
    </div>
  );
};

export default Profile;
