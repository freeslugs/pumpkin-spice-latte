import React, { useState } from 'react';
import { useReadContract, useAccount } from 'wagmi';
import {
  pumpkinSpiceLatteAddress,
  pumpkinSpiceLatteAbi,
  CONTRACTS,
} from '../contracts/PumpkinSpiceLatte';
import { usdcAddress, usdcAbi } from '../contracts/USDC';
import { formatUnits, parseUnits } from 'viem';
import { AlertCircle, X } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';

const PSLHome = () => {
  const [isRightStackOpen, setIsRightStackOpen] = useState(false);
  const [activeAction, setActiveAction] = useState<
    'deposit' | 'withdraw' | null
  >(null);
  const [amount, setAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const { isConnected, chain, address } = useAccount();

  // Check if we're on a supported network
  const isSupportedNetwork =
    chain && CONTRACTS[chain.id as keyof typeof CONTRACTS];
  const targetChainId = isSupportedNetwork ? chain!.id : 1;
  const contractAddress =
    CONTRACTS[targetChainId as keyof typeof CONTRACTS]?.pumpkinSpiceLatte ??
    pumpkinSpiceLatteAddress;

  // Get the asset address from the PSL contract
  const { data: assetAddress } = useReadContract({
    address: contractAddress,
    abi: pumpkinSpiceLatteAbi,
    functionName: 'ASSET',
    chainId: targetChainId,
    query: {
      enabled: isConnected && !!address,
    },
  });

  // Use the asset address from PSL contract, fallback to USDC address
  const currentTokenAddress = assetAddress || usdcAddress;

  // Fetch USDC balance from the token contract
  const { data: userBalanceData } = useReadContract({
    address: currentTokenAddress as `0x${string}`,
    abi: usdcAbi,
    functionName: 'balanceOf',
    chainId: targetChainId,
    args: [address as `0x${string}`],
    query: {
      refetchInterval: 30000,
      enabled: isConnected && !!address,
    },
  });

  // Fetch user's PSL balance (deposits) from the PSL contract
  const { data: userPSLBalanceData } = useReadContract({
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
      enabled: isConnected && !!address,
    },
  });

  const { data: totalPrincipalData } = useReadContract({
    address: contractAddress,
    abi: pumpkinSpiceLatteAbi,
    functionName: 'totalPrincipal',
    chainId: targetChainId,
    query: {
      refetchInterval: 30000,
      enabled: isConnected && !!address,
    },
  });

  const { data: nextRoundTimestampData } = useReadContract({
    address: contractAddress,
    abi: pumpkinSpiceLatteAbi,
    functionName: 'nextRoundTimestamp',
    chainId: targetChainId,
    query: {
      refetchInterval: 30000,
      enabled: isConnected && !!address,
    },
  });

  const userBalance = userBalanceData
    ? parseFloat(formatUnits(userBalanceData as bigint, 6))
    : 0;

  const userPSLBalance = userPSLBalanceData
    ? parseFloat(formatUnits(userPSLBalanceData as bigint, 6))
    : 0;

  const totalAssets = totalAssetsData
    ? parseFloat(formatUnits(totalAssetsData as bigint, 6))
    : 0;

  const totalPrincipal = totalPrincipalData
    ? parseFloat(formatUnits(totalPrincipalData as bigint, 6))
    : 0;

  // Calculate yield percentage
  const yieldPercentage =
    totalPrincipal > 0
      ? (((totalAssets - totalPrincipal) / totalPrincipal) * 100).toFixed(2)
      : '0.00';

  // Calculate time remaining until next draw
  const formatTimeRemaining = (timestamp: bigint) => {
    const now = Math.floor(Date.now() / 1000);
    const timeLeft = Number(timestamp) - now;

    if (timeLeft <= 0) return 'Draw in progress';

    const days = Math.floor(timeLeft / 86400);
    const hours = Math.floor((timeLeft % 86400) / 3600);
    const minutes = Math.floor((timeLeft % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const countdown = nextRoundTimestampData
    ? formatTimeRemaining(nextRoundTimestampData as bigint)
    : 'Weekly';

  const handleActionClick = (action: 'deposit' | 'withdraw') => {
    setActiveAction(action);
    setIsRightStackOpen(true);
    setAmount('');
  };

  const closeRightStack = () => {
    setIsRightStackOpen(false);
    setActiveAction(null);
    setAmount('');
  };

  const handleConfirm = async () => {
    if (!amount || parseFloat(amount) <= 0) return;

    setIsProcessing(true);
    // Here you would implement the actual deposit/withdraw logic
    // For now, we'll just simulate a delay
    setTimeout(() => {
      setIsProcessing(false);
      closeRightStack();
    }, 2000);
  };

  const isAmountValid = amount && parseFloat(amount) > 0;
  const canWithdraw =
    activeAction === 'withdraw' && parseFloat(amount) <= userBalance;

  return (
    <div className='relative min-h-screen flex flex-col'>
      {/* Main Content */}
      <div className='flex-1 p-4 space-y-6'>
        {/* Network Status */}
        {isConnected && !isSupportedNetwork && (
          <div className='p-4 rounded-lg border bg-amber-50 border-amber-200 text-amber-800'>
            <div className='flex items-center gap-3'>
              <AlertCircle className='h-5 w-5 text-amber-600' />
              <div>
                <p className='font-medium'>Network not supported</p>
              </div>
            </div>
          </div>
        )}

        {/* Main Content - Big Number Layout */}
        <div className='space-y-8'>
          {/* Total Deposit Number */}
          <Card className='border-0 shadow-none bg-transparent'>
            <CardContent className='p-0'>
              <div className='text-left'>
                <div className='mb-2'>
                  <p className='text-sm text-muted-foreground'>Total Deposit</p>
                </div>
                <div className='text-6xl font-black text-foreground'>
                  ${userPSLBalance.toLocaleString()}
                </div>
                <p className='text-lg text-muted-foreground'>USDC</p>
              </div>
            </CardContent>
          </Card>

          {/* Yield and Countdown */}
          <div className='space-y-4'>
            <Card>
              <CardContent className='p-4'>
                <div className='flex justify-between items-center'>
                  <div className='flex items-center gap-2'>
                    <span className='text-xl'>📈</span>
                    <span className='text-sm text-muted-foreground'>
                      Yield Generated
                    </span>
                  </div>
                  <span className='text-lg font-bold text-green-600'>
                    {yieldPercentage}%
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className='p-4'>
                <div className='flex justify-between items-center'>
                  <div className='flex items-center gap-2'>
                    <span className='text-xl'>⏰</span>
                    <span className='text-sm text-muted-foreground'>
                      Next Lottery Draw
                    </span>
                  </div>
                  <span className='text-lg font-bold text-orange-600'>
                    {countdown}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Action Buttons - Now part of normal document flow */}
        <div className='pt-8 pb-6'>
          <div className='flex gap-4'>
            <Button
              onClick={() => handleActionClick('deposit')}
              variant='outline'
              className='flex-1 h-16 text-lg font-bold border-2 border-orange-500 text-orange-500 hover:bg-orange-50 rounded-xl'
            >
              💸 Deposit
            </Button>

            <Button
              onClick={() => handleActionClick('withdraw')}
              variant='outline'
              className='flex-1 h-16 text-lg font-bold border-2 border-orange-400 text-orange-500 hover:bg-orange-50 rounded-xl'
            >
              💰 Withdraw
            </Button>
          </div>
        </div>
      </div>

      {/* Right Side Stack Navigation */}
      {isRightStackOpen && (
        <div className='fixed inset-0 z-50 flex justify-end'>
          {/* Backdrop */}
          <div
            className='absolute inset-0 bg-black bg-opacity-50'
            onClick={closeRightStack}
          />

          {/* Right Stack */}
          <div className='relative w-full max-w-md bg-white h-full shadow-2xl transform transition-transform duration-300 ease-out'>
            {/* Header */}
            <div className='flex items-center justify-between p-6 border-b border-gray-200'>
              <h2 className='text-xl font-bold text-gray-900'>
                {activeAction === 'deposit'
                  ? '💸 Deposit USDC'
                  : '💰 Withdraw USDC'}
              </h2>
              <button
                onClick={closeRightStack}
                className='p-2 hover:bg-gray-100 rounded-lg transition-colors'
              >
                <X className='w-5 h-5 text-gray-500' />
              </button>
            </div>

            {/* Content */}
            <div className='p-6 space-y-6'>
              {/* Amount Input */}
              <div className='space-y-2'>
                <label className='text-sm font-medium text-gray-700'>
                  Amount (USDC)
                </label>
                <Input
                  type='number'
                  placeholder='0.00'
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className='text-2xl font-bold text-center h-16 border-2 border-gray-300 rounded-xl focus:border-orange-500 focus:ring-orange-500'
                />
              </div>

              {/* Info Cards */}
              <div className='space-y-3'>
                {activeAction === 'deposit' && (
                  <div className='p-4 rounded-lg bg-blue-50 border border-blue-200'>
                    <div className='flex items-center gap-2 mb-2'>
                      <span className='text-blue-600'>💡</span>
                      <span className='text-sm font-medium text-blue-800'>
                        Deposit Info
                      </span>
                    </div>
                    <p className='text-sm text-blue-700'>
                      Each USDC gives you 1 lottery ticket. Your principal is
                      safe and can be withdrawn anytime.
                    </p>
                  </div>
                )}

                {activeAction === 'withdraw' && (
                  <div className='p-4 rounded-lg bg-green-50 border border-green-200'>
                    <div className='flex items-center gap-2 mb-2'>
                      <span className='text-blue-600'>✅</span>
                      <span className='text-sm font-medium text-green-800'>
                        Withdrawal Info
                      </span>
                    </div>
                    <p className='text-sm text-green-700'>
                      You can withdraw your principal at any time. Only
                      generated yield goes to the prize pool.
                    </p>
                  </div>
                )}

                {/* Current Balance */}
                <div className='p-4 rounded-lg bg-gray-50 border border-gray-200'>
                  <div className='flex justify-between items-center'>
                    <span className='text-sm text-gray-600'>
                      Current Balance
                    </span>
                    <span className='font-bold text-gray-900'>
                      {userPSLBalance.toLocaleString()} USDC
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className='space-y-3 pt-4'>
                <Button
                  onClick={handleConfirm}
                  disabled={
                    !isAmountValid ||
                    (activeAction === 'withdraw' && !canWithdraw) ||
                    isProcessing
                  }
                  className='w-full h-14 text-lg font-bold bg-orange-500 text-white hover:bg-orange-600 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed'
                >
                  {isProcessing
                    ? 'Processing...'
                    : `Confirm ${
                        activeAction === 'deposit' ? 'Deposit' : 'Withdrawal'
                      }`}
                </Button>

                <Button
                  onClick={closeRightStack}
                  variant='outline'
                  className='w-full h-12 text-base font-medium border-2 border-gray-300 text-gray-600 hover:bg-gray-50 rounded-xl'
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PSLHome;
