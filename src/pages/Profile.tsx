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
      {/* Header */}
      <div className='flex items-center bg-white pb-2 justify-between'>
        <button
          onClick={() => navigate(-1)}
          className='text-[#181411] flex size-12 shrink-0 items-center'
        >
          <ArrowLeft className='w-6 h-6' />
        </button>
        <h2 className='text-[#181411] text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center pr-12'>
          Profile
        </h2>
      </div>

      {/* User Info */}
      <div className='flex flex-col gap-2 rounded-lg p-6 bg-[#f5f2f0]'>
        <div className='flex items-center gap-3'>
          <User className='w-8 h-8 text-orange-600' />
          <div>
            <p className='text-[#181411] text-base font-medium leading-normal'>
              Wallet Address
            </p>
            <p className='text-[#181411] tracking-light text-sm font-mono'>
              {address
                ? `${address.slice(0, 6)}...${address.slice(-4)}`
                : 'Not connected'}
            </p>
          </div>
        </div>
      </div>

      {/* User Stats */}
      <div className='space-y-3'>
        <h3 className='text-lg font-semibold text-[#181411]'>Your Stats</h3>
        <div className='grid grid-cols-1 gap-3'>
          <div className='p-4 rounded-lg border border-[#f5f2f0]'>
            <div className='flex items-center gap-3'>
              <Wallet className='w-6 h-6 text-green-600' />
              <div>
                <p className='text-sm text-[#8a7360]'>Total Balance</p>
                <p className='text-lg font-semibold text-[#181411]'>
                  {userBalance.toLocaleString()} USDC
                </p>
              </div>
            </div>
          </div>

          <div className='p-4 rounded-lg border border-[#f5f2f0]'>
            <div className='flex items-center gap-3'>
              <Award className='w-6 h-6 text-amber-600' />
              <div>
                <p className='text-sm text-[#8a7360]'>Generated Yield</p>
                <p className='text-lg font-semibold text-[#181411]'>
                  {userYield.toFixed(2)} USDC
                </p>
              </div>
            </div>
          </div>

          <div className='p-4 rounded-lg border border-[#f5f2f0]'>
            <div className='flex items-center gap-3'>
              <Clock className='w-6 h-6 text-blue-600' />
              <div>
                <p className='text-sm text-[#8a7360]'>Principal Deposited</p>
                <p className='text-lg font-semibold text-[#181411]'>
                  {userBalance.toLocaleString()} USDC
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Network Info */}
      {isConnected && (
        <div className='space-y-3'>
          <h3 className='text-lg font-semibold text-[#181411]'>Network</h3>
          <div className='p-4 rounded-lg border border-[#f5f2f0]'>
            <p className='text-sm text-[#8a7360]'>Current Network</p>
            <p className='text-lg font-semibold text-[#181411]'>
              {chain?.name || 'Unknown'}
            </p>
            {!isSupportedNetwork && (
              <p className='text-sm text-amber-600 mt-2'>
                ⚠️ This network is not supported
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
