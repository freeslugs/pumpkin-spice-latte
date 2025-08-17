import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  useReadContract,
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi';
import { motion, AnimatePresence } from 'framer-motion';
import {
  pumpkinSpiceLatteAddress,
  pumpkinSpiceLatteAbi,
  CONTRACTS,
} from '../contracts/PumpkinSpiceLatte';
import { usdcAbi, usdcAddress } from '../contracts/USDC';
import { formatUnits, isAddress, parseUnits } from 'viem';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { AlertCircle, X } from 'lucide-react';
import { useIsMobile } from '../hooks/use-mobile';
import { useToast } from '../components/ui/use-toast';
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
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [isRightStackOpen, setIsRightStackOpen] = useState(false);
  const [activeAction, setActiveAction] = useState<'deposit' | 'withdraw'>(
    'deposit'
  );
  const [amount, setAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [approvalHash, setApprovalHash] = useState<`0x${string}` | undefined>(
    undefined
  );
  const [depositHash, setDepositHash] = useState<`0x${string}` | undefined>(
    undefined
  );
  const [withdrawHash, setWithdrawHash] = useState<`0x${string}` | undefined>(
    undefined
  );
  const [pendingDepositAmount, setPendingDepositAmount] = useState<
    bigint | undefined
  >(undefined);
  const autoDepositTriggeredRef = useRef(false);
  const amountInputRef = useRef<HTMLInputElement | null>(null);
  const [awardHash, setAwardHash] = useState<`0x${string}` | undefined>(
    undefined
  );

  // Check if we're on a supported network
  const isSupportedNetwork =
    chain && CONTRACTS[chain.id as keyof typeof CONTRACTS];
  const targetChainId = isSupportedNetwork ? chain!.id : 114;
  const contractAddress =
    CONTRACTS[targetChainId as keyof typeof CONTRACTS]?.pumpkinSpiceLatte ??
    pumpkinSpiceLatteAddress;

  // Prefer on-chain ASSET to avoid mismatches
  const { data: assetOnChain } = useReadContract({
    address: contractAddress,
    abi: pumpkinSpiceLatteAbi,
    functionName: 'ASSET',
    chainId: targetChainId,
    query: {
      enabled: Boolean(contractAddress),
      staleTime: 60_000,
      refetchInterval: 60_000,
    },
  } as any);

  const mappedTokenAddress =
    (CONTRACTS as any)[targetChainId]?.usdc ?? usdcAddress;
  const currentTokenAddress =
    typeof assetOnChain === 'string' && isAddress(assetOnChain)
      ? (assetOnChain as `0x${string}`)
      : (mappedTokenAddress as `0x${string}`);

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

  const userPSLBalance = userBalanceData
    ? parseFloat(formatUnits(userBalanceData as bigint, 6))
    : 0;

  // Yield (static for now) and probability (live from contract)
  const yieldPercentage = '2.5';

  const { data: winProbWad, refetch: refetchWinProb } = useReadContract({
    address: contractAddress,
    abi: pumpkinSpiceLatteAbi,
    functionName: 'currentWinProbability',
    chainId: targetChainId,
    query: {
      refetchInterval: 5000,
      enabled: Boolean(contractAddress),
    },
  } as any);

  const nextDrawProbability = useMemo(() => {
    try {
      // winProbWad is 1e18-based probability. Convert to percentage with two decimals.
      const wad = (winProbWad as bigint) ?? 0n;
      // Multiply by 100 to get percent, then divide by 1e16 to keep two decimals as integer
      const pctHundredths = Number((wad * 10000n) / 1000000000000000000n) / 100; // two decimals
      return pctHundredths.toFixed(2);
    } catch {
      return '0.00';
    }
  }, [winProbWad]);

  // Wallet allowance and balance for USDC
  const contractAddressHex = contractAddress as `0x${string}`;
  const accountAddress = address as `0x${string}` | undefined;

  const { data: allowance = 0n, refetch: refetchAllowance } = useReadContract({
    address: currentTokenAddress,
    abi: usdcAbi,
    functionName: 'allowance',
    args: [accountAddress as `0x${string}`, contractAddressHex],
    query: {
      enabled: isConnected && !!address && !!isSupportedNetwork,
      refetchInterval: 30000,
    },
  });

  const { data: walletBalance = 0n } = useReadContract({
    address: currentTokenAddress,
    abi: usdcAbi,
    functionName: 'balanceOf',
    args: [accountAddress as `0x${string}`],
    query: {
      enabled: isConnected && !!address && !!isSupportedNetwork,
      refetchInterval: 30000,
    },
  } as any);

  // Winner/prize reads (refetched upon award confirmation)
  const { data: lastWinner, refetch: refetchLastWinner } = useReadContract({
    address: contractAddress,
    abi: pumpkinSpiceLatteAbi,
    functionName: 'lastWinner',
    chainId: targetChainId,
    query: { enabled: false },
  } as any);
  const { data: lastPrizeAmount, refetch: refetchLastPrize } = useReadContract({
    address: contractAddress,
    abi: pumpkinSpiceLatteAbi,
    functionName: 'lastPrizeAmount',
    chainId: targetChainId,
    query: { enabled: false },
  } as any);

  const parsedAmount: bigint = useMemo(() => {
    if (!amount || Number(amount) <= 0) return 0n;
    try {
      return parseUnits(amount, 6);
    } catch {
      return 0n;
    }
  }, [amount]);

  const walletUSDCDisplay = useMemo(() => {
    try {
      return parseFloat(formatUnits(walletBalance as bigint, 6));
    } catch {
      return 0;
    }
  }, [walletBalance]);

  const { writeContract: approve, isPending: isApproving } = useWriteContract({
    onSuccess: (hash: `0x${string}`) => {
      setApprovalHash(hash);
      toast({
        title: 'Approval submitted',
        description: 'Waiting for confirmation...',
      });
    },
    onError: (error) => {
      toast({
        title: 'Approval Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  } as any);

  const {
    isLoading: isConfirmingApproval,
    isSuccess: isApprovalConfirmed,
    error: approvalError,
  } = useWaitForTransactionReceipt({
    chainId: targetChainId,
    hash: approvalHash,
    confirmations: 1,
    query: { enabled: Boolean(approvalHash), refetchInterval: 1000 },
  } as any);

  const { writeContract: deposit, isPending: isDepositing } = useWriteContract({
    onSuccess: (hash: `0x${string}`) => {
      setDepositHash(hash);
      toast({
        title: 'Deposit submitted',
        description: 'Waiting for confirmation...',
      });
    },
    onError: (error) => {
      toast({
        title: 'Deposit Failed',
        description: error.message,
        variant: 'destructive',
      });
      autoDepositTriggeredRef.current = false;
    },
  } as any);

  const {
    isLoading: isConfirmingDeposit,
    isSuccess: isDepositConfirmed,
    error: depositError,
  } = useWaitForTransactionReceipt({
    chainId: targetChainId,
    hash: depositHash,
    confirmations: 1,
    query: { enabled: Boolean(depositHash), refetchInterval: 1000 },
  } as any);

  const { writeContract: withdraw, isPending: isWithdrawing } =
    useWriteContract({
      onSuccess: (hash: `0x${string}`) => {
        setWithdrawHash(hash);
        toast({
          title: 'Withdrawal submitted',
          description: 'Waiting for confirmation...',
        });
      },
      onError: (error) => {
        toast({
          title: 'Withdrawal Failed',
          description: error.message,
          variant: 'destructive',
        });
      },
    } as any);

  const {
    isLoading: isConfirmingWithdraw,
    isSuccess: isWithdrawConfirmed,
    error: withdrawError,
  } = useWaitForTransactionReceipt({
    chainId: targetChainId,
    hash: withdrawHash,
    confirmations: 1,
    query: { enabled: Boolean(withdrawHash), refetchInterval: 1000 },
  } as any);

  // Award prize write + receipt
  const { writeContract: tryAwardPrize, isPending: isAwarding } =
    useWriteContract({
      onSuccess: (hash: `0x${string}`) => {
        setAwardHash(hash);
        toast({
          title: '🎲 Roll submitted!',
          description: 'Summoning the randomness oracle...',
        });
      },
      onError: (error) => {
        toast({
          title: '😅 Not this time',
          description:
            error.message || 'Round not ready or no prize yet. Try again soon!',
          variant: 'destructive',
        });
      },
    } as any);

  const {
    isLoading: isConfirmingAward,
    isSuccess: isAwardConfirmed,
    error: awardError,
  } = useWaitForTransactionReceipt({
    chainId: targetChainId,
    hash: awardHash,
    confirmations: 1,
    query: { enabled: Boolean(awardHash), refetchInterval: 1000 },
  } as any);

  useEffect(() => {
    if (approvalError) {
      toast({
        title: 'Approval Error',
        description: approvalError.message,
        variant: 'destructive',
      });
    }
  }, [approvalError, toast]);

  useEffect(() => {
    if (depositError) {
      toast({
        title: 'Deposit Error',
        description: depositError.message,
        variant: 'destructive',
      });
    }
  }, [depositError, toast]);

  useEffect(() => {
    if (withdrawError) {
      toast({
        title: 'Withdrawal Error',
        description: withdrawError.message,
        variant: 'destructive',
      });
    }
  }, [withdrawError, toast]);

  useEffect(() => {
    if (awardError) {
      toast({
        title: '😅 Not this time',
        description: awardError.message,
        variant: 'destructive',
      });
    }
  }, [awardError, toast]);

  useEffect(() => {
    if (isApprovalConfirmed) {
      refetchAllowance();
      if (
        !autoDepositTriggeredRef.current &&
        pendingDepositAmount &&
        isAddress(contractAddress)
      ) {
        autoDepositTriggeredRef.current = true;
        deposit({
          address: contractAddress,
          abi: pumpkinSpiceLatteAbi,
          functionName: 'deposit',
          args: [pendingDepositAmount],
        });
      }
      setApprovalHash(undefined);
    }
  }, [
    isApprovalConfirmed,
    pendingDepositAmount,
    contractAddress,
    deposit,
    refetchAllowance,
  ]);

  // Poll allowance while waiting for approval indexers – auto deposit when ready
  useEffect(() => {
    if (!isConnected || !address || !isSupportedNetwork) return;
    if (!pendingDepositAmount || pendingDepositAmount === 0n) return;

    const intervalId = setInterval(async () => {
      try {
        const result = await (refetchAllowance() as unknown as Promise<
          { data?: bigint } | undefined
        >);
        const latestAllowance =
          result && result.data !== undefined ? result.data! : allowance;
        if (latestAllowance >= pendingDepositAmount) {
          if (!autoDepositTriggeredRef.current && isAddress(contractAddress)) {
            autoDepositTriggeredRef.current = true;
            deposit({
              address: contractAddress,
              abi: pumpkinSpiceLatteAbi,
              functionName: 'deposit',
              args: [pendingDepositAmount],
            });
          }
          clearInterval(intervalId);
        }
      } catch {
        // ignore
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [
    isConnected,
    address,
    isSupportedNetwork,
    pendingDepositAmount,
    refetchAllowance,
    allowance,
    contractAddress,
    deposit,
  ]);

  useEffect(() => {
    if (isDepositConfirmed) {
      toast({
        title: 'Deposit Successful',
        description: 'Your USDC has been deposited.',
      });
      setAmount('');
      setDepositHash(undefined);
      setPendingDepositAmount(undefined);
      autoDepositTriggeredRef.current = false;
      refetchAllowance();
    }
  }, [isDepositConfirmed, refetchAllowance, toast]);

  useEffect(() => {
    if (isWithdrawConfirmed) {
      toast({
        title: 'Withdrawal Successful',
        description: 'Your USDC has been withdrawn.',
      });
      setAmount('');
      setWithdrawHash(undefined);
    }
  }, [isWithdrawConfirmed, toast]);

  useEffect(() => {
    if (isAwardConfirmed) {
      // Best-effort refresh and then celebrate
      Promise.allSettled([refetchLastWinner(), refetchLastPrize()]).then(
        (results) => {
          const prize =
            results[1].status === 'fulfilled' && results[1].value?.data
              ? (results[1].value.data as bigint)
              : 0n;
          const winner =
            results[0].status === 'fulfilled' && results[0].value?.data
              ? (results[0].value.data as string)
              : undefined;
          const prizeDisplay = prize
            ? `${formatUnits(prize, 6)} USDC`
            : 'a mystery prize';
          const youWon =
            winner && address && winner.toLowerCase() === address.toLowerCase();
          toast({
            title: youWon ? '🎉 You won!' : '🎉 Prize Awarded!',
            description: youWon
              ? `Enjoy your ${prizeDisplay}!`
              : `Someone just won ${prizeDisplay}. Better luck next time!`,
          });
        }
      );
      setAwardHash(undefined);
    }
  }, [isAwardConfirmed, refetchLastWinner, refetchLastPrize, toast, address]);

  const handleActionClick = (action: 'deposit' | 'withdraw') => {
    setActiveAction(action);
    setIsRightStackOpen(true);
  };

  // Auto focus/select amount input when opening the modal
  useEffect(() => {
    if (isRightStackOpen) {
      const t = setTimeout(() => {
        if (amountInputRef.current) {
          amountInputRef.current.focus();
          amountInputRef.current.select();
        }
      }, 50);
      return () => clearTimeout(t);
    }
  }, [isRightStackOpen, activeAction]);

  const closeRightStack = () => {
    setIsRightStackOpen(false);
    setAmount('');
  };

  const handleConfirm = async () => {
    if (!isConnected || !isSupportedNetwork || !isAddress(contractAddress))
      return;
    if (parsedAmount === 0n) return;

    setIsProcessing(true);

    try {
      if (activeAction === 'deposit') {
        if (allowance < parsedAmount) {
          setPendingDepositAmount(parsedAmount);
          autoDepositTriggeredRef.current = false;
          approve({
            address: currentTokenAddress,
            abi: usdcAbi,
            functionName: 'approve',
            args: [contractAddress, parsedAmount],
          });
        } else {
          setPendingDepositAmount(undefined);
          deposit({
            address: contractAddress,
            abi: pumpkinSpiceLatteAbi,
            functionName: 'deposit',
            args: [parsedAmount],
          });
        }
      } else {
        // withdraw
        withdraw({
          address: contractAddress,
          abi: pumpkinSpiceLatteAbi,
          functionName: 'withdraw',
          args: [parsedAmount],
        });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const isAmountValid = amount && parseFloat(amount) > 0;
  const canWithdraw = parseFloat(amount) <= userPSLBalance;
  const isBusy =
    isApproving ||
    isDepositing ||
    isConfirmingApproval ||
    isConfirmingDeposit ||
    isWithdrawing ||
    isConfirmingWithdraw;
  const isTryLuckBusy = isAwarding || isConfirmingAward;

  return (
    <div className={`${isMobile ? 'min-h-screen' : 'h-full'} flex flex-col`}>
      {/* Main Content */}
      <div
        className={`flex-1 p-4 space-y-6 ${isMobile ? '' : 'overflow-y-auto'}`}
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
          className={`space-y-6 ${
            isMobile ? '' : 'grid grid-cols-2 gap-8 max-w-4xl mx-auto'
          }`}
        >
          {/* Total Deposit Number */}
          <div className='text-left'>
            <Card className='border-0 shadow-none bg-transparent'>
              <CardContent className='p-0'>
                <div className='mb-2'>
                  <p className='text-sm text-muted-foreground'>
                    Total PSL Deposit
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
              </CardContent>
            </Card>
          </div>

          {/* Yield and Countdown - Desktop: Right side, Mobile: Below Total Deposit */}
          <div
            className={`${
              isMobile
                ? 'mt-6 space-y-3'
                : 'flex flex-col justify-center space-y-4'
            }`}
          >
            <div className='flex items-center gap-2'>
              <span className='text-xl'>📈</span>
              <span className='text-sm text-muted-foreground'>Yield</span>
              <span className='text-lg font-bold text-green-600 ml-auto'>
                {yieldPercentage}%
              </span>
            </div>

            <div className='flex items-center gap-2'>
              <span className='text-xl'>⏰</span>
              <span className='text-sm text-muted-foreground'>
                Probability of next drawing ...
              </span>
              <span className='text-lg font-bold text-orange-600 ml-auto'>
                {nextDrawProbability}%
              </span>
            </div>

            {/* Try your luck button positioned below probability */}
            <div className='pt-2'>
              <Button
                onClick={() =>
                  tryAwardPrize({
                    address: contractAddress,
                    abi: pumpkinSpiceLatteAbi,
                    functionName: 'awardPrize',
                  })
                }
                disabled={!isConnected || !isSupportedNetwork || isTryLuckBusy}
                variant='outline'
                className='w-full py-3 text-base border-gray-400 text-orange-600 hover:bg-orange-100 rounded-lg'
              >
                {isTryLuckBusy ? 'Rolling…' : '🍀 Try your luck'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons - Desktop: Below content, Mobile: At bottom */}
      <div className={`${isMobile ? 'p-2 pb-40' : 'pt-12'}`}>
        <div className={`flex gap-1 ${isMobile ? '' : 'max-w-2xl mx-auto'}`}>
          <div className='flex-1'>
            <Button
              onClick={() => handleActionClick('deposit')}
              className='w-full h-20 text-lg font-bold bg-orange-500 hover:bg-gray-900 text-white rounded-xl'
            >
              💸 Deposit
            </Button>
          </div>

          <div className='flex-1'>
            <Button
              onClick={() => handleActionClick('withdraw')}
              variant='outline'
              className='w-full h-20 text-lg border border-orange-400 text-orange-500 hover:bg-orange-100 rounded-xl'
            >
              💰 Withdraw
            </Button>
          </div>
        </div>
      </div>

      {/* Right Side Stack Navigation - Mobile Only */}
      <AnimatePresence>
        {isMobile && isRightStackOpen && (
          <motion.div
            className='fixed inset-0 z-50 flex items-end'
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Backdrop */}
            <motion.div
              className='absolute inset-0 bg-black bg-opacity-50'
              onClick={closeRightStack}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />

            {/* Right Stack - 80% height with slide up animation */}
            <motion.div
              className='relative w-full bg-white h-[80vh] shadow-2xl rounded-t-3xl'
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{
                type: 'spring',
                damping: 25,
                stiffness: 200,
                duration: 0.3,
              }}
            >
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
              <div className='p-6 space-y-6 overflow-y-auto h-[calc(80vh-80px)]'>
                {/* Amount Input */}
                <div className='space-y-2'>
                  <label className='text-sm font-medium text-gray-700'>
                    Amount (USDC)
                  </label>
                  <div>
                    <Input
                      type='number'
                      placeholder='0'
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      ref={amountInputRef}
                      className='text-4xl font-bold text-left h-16 border-2 border-gray-300 rounded-xl focus:border-orange-500 focus:ring-orange-500'
                    />
                  </div>
                </div>

                {/* Info Cards */}
                <div className='space-y-3'>
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
                        {walletUSDCDisplay.toLocaleString()} USDC
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
                            activeAction === 'deposit'
                              ? 'Deposit'
                              : 'Withdrawal'
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
                    placeholder='0'
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    ref={amountInputRef}
                    className='text-4xl font-bold text-left h-16 border-2 border-gray-300 rounded-xl focus:border-orange-500 focus:ring-orange-500'
                  />
                </div>
              </div>

              {/* Info Cards */}
              <div className='space-y-3'>
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
                      {walletUSDCDisplay.toLocaleString()} USDC
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
