import React, { useState } from 'react';
import { useReadContract, useAccount } from 'wagmi';
import { motion, AnimatePresence } from 'framer-motion';
import {
  pumpkinSpiceLatteAddress,
  pumpkinSpiceLatteAbi,
  CONTRACTS,
} from '../contracts/PumpkinSpiceLatte';
import { formatUnits } from 'viem';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { AlertCircle, X } from 'lucide-react';
import { useIsMobile } from '../hooks/use-mobile';
import {
  cardVariants,
  staggerContainer,
  buttonVariants,
  modalVariants,
  backdropVariants,
  fadeUp,
  scaleIn,
} from '../lib/animations';

const PSLHome = () => {
  const { isConnected, chain, address } = useAccount();
  const isMobile = useIsMobile();
  const [isRightStackOpen, setIsRightStackOpen] = useState(false);
  const [activeAction, setActiveAction] = useState<'deposit' | 'withdraw'>(
    'deposit'
  );
  const [amount, setAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Check if we're on a supported network
  const isSupportedNetwork =
    chain && CONTRACTS[chain.id as keyof typeof CONTRACTS];
  const targetChainId = isSupportedNetwork ? chain!.id : 114;
  const contractAddress =
    CONTRACTS[targetChainId as keyof typeof CONTRACTS]?.pumpkinSpiceLatte ??
    pumpkinSpiceLatteAddress;

  const { data: userBalanceData } = useReadContract({
    address: contractAddress,
    abi: pumpkinSpiceLatteAbi,
    chainId: targetChainId,
    args: [address as `0x${string}`],
    query: {
      refetchInterval: 30000,
      enabled: isConnected && !!address,
    },
  });

  const userPSLBalance = userBalanceData
    ? parseFloat(formatUnits(userBalanceData as bigint, 6))
    : 0;

  // Mock data for yield and countdown
  const yieldPercentage = '2.5';
  const countdown = '3d 12h 45m';

  const handleActionClick = (action: 'deposit' | 'withdraw') => {
    setActiveAction(action);
    setIsRightStackOpen(true);
  };

  const closeRightStack = () => {
    setIsRightStackOpen(false);
    setAmount('');
  };

  const handleConfirm = async () => {
    setIsProcessing(true);
    // Simulate processing
    setTimeout(() => {
      setIsProcessing(false);
      closeRightStack();
    }, 2000);
  };

  const isAmountValid = amount && parseFloat(amount) > 0;
  const canWithdraw = parseFloat(amount) <= userPSLBalance;

  return (
    <div className='relative min-h-screen flex flex-col'>
      {/* Main Content */}
      <div
        className={`flex-1 p-4 space-y-6 ${
          isMobile ? '' : 'max-w-4xl mx-auto'
        }`}
      >
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
        <div
          className={`space-y-8 ${isMobile ? '' : 'grid grid-cols-2 gap-8'}`}
        >
          {/* Total Deposit Number */}
          <div>
            <Card className='border-0 shadow-none bg-transparent'>
              <CardContent className='p-0'>
                <div className='text-left'>
                  <div className='mb-2'>
                    <p className='text-sm text-muted-foreground'>
                      Total Deposit
                    </p>
                  </div>
                  <div
                    className={`font-black text-foreground ${
                      isMobile ? 'text-6xl' : 'text-7xl'
                    }`}
                  >
                    ${userPSLBalance.toLocaleString()}
                  </div>
                  <p className='text-lg text-muted-foreground'>USDC</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Yield and Countdown - Desktop: Right side, Mobile: Below */}
          <div
            className={`space-y-4 ${
              isMobile ? '' : 'flex flex-col justify-center'
            }`}
          >
            <div>
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
            </div>

            <div>
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
        </div>

        {/* Action Buttons - Desktop: Below content, Mobile: Above navbar */}
        <div className={`${isMobile ? 'pt-8 pb-6' : 'pt-12'}`}>
          <div className={`flex gap-4 ${isMobile ? '' : 'max-w-md'}`}>
            <div className='flex-1'>
              <Button
                onClick={() => handleActionClick('deposit')}
                variant='outline'
                className='w-full h-16 text-lg font-bold border-2 border-orange-500 text-orange-500 hover:bg-orange-50 rounded-xl'
              >
                💸 Deposit
              </Button>
            </div>

            <div className='flex-1'>
              <Button
                onClick={() => handleActionClick('withdraw')}
                variant='outline'
                className='w-full h-16 text-lg font-bold border-2 border-orange-400 text-orange-500 hover:bg-orange-50 rounded-xl'
              >
                💰 Withdraw
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side Stack Navigation - Mobile Only */}
      {isMobile && isRightStackOpen && (
        <div className='fixed inset-0 z-50 flex justify-end'>
          {/* Backdrop */}
          <div
            className='absolute inset-0 bg-black bg-opacity-50'
            onClick={closeRightStack}
          />

          {/* Right Stack */}
          <div className='relative w-full max-w-md bg-white h-full shadow-2xl'>
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
                <div>
                  <Input
                    type='number'
                    placeholder='0.00'
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className='text-2xl font-bold text-center h-16 border-2 border-gray-300 rounded-xl focus:border-orange-500 focus:ring-orange-500'
                  />
                </div>
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
                <div>
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
                </div>

                <div>
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
        </div>
      )}

      {/* Desktop Modal - Center Modal for Desktop */}
      {!isMobile && isRightStackOpen && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50'>
          <div className='bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto'>
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
                <div>
                  <Input
                    type='number'
                    placeholder='0.00'
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className='text-2xl font-bold text-center h-16 border-2 border-gray-300 rounded-xl focus:border-orange-500 focus:ring-orange-500'
                  />
                </div>
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
                <div>
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
                </div>

                <div>
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
        </div>
      )}
    </div>
  );
};

export default PSLHome;
