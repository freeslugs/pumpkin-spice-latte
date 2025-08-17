import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  useReadContract,
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useWatchContractEvent,
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
import { useConnectModal } from '@rainbow-me/rainbowkit';

const PSLHome = () => {
  const { isConnected, chain, address } = useAccount();
  const { openConnectModal } = useConnectModal();
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

  // Add state for tracking the award outcome
  const [awardOutcome, setAwardOutcome] = useState<
    'pending' | 'success' | 'no-prize' | null
  >(null);
  const [awardResult, setAwardResult] = useState<{
    winner?: string;
    amount?: bigint;
    caller?: string;
  } | null>(null);

  // Step tracking for deposit flow
  const [depositStep, setDepositStep] = useState<
    'idle' | 'approving' | 'approved' | 'depositing' | 'completed'
  >('idle');

  // Step tracking for withdraw flow
  const [withdrawStep, setWithdrawStep] = useState<
    'idle' | 'withdrawing' | 'completed'
  >('idle');

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

  const { data: userBalanceData, refetch: refetchUserBalance } =
    useReadContract({
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
      return pctHundredths.toFixed(1);
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

  const {
    writeContract: deposit,
    writeContractAsync: depositAsync,
    isPending: isDepositing,
  } = useWriteContract({
    onSuccess: (hash: `0x${string}`) => {
      console.log('Deposit onSuccess called with hash:', hash);
      setDepositHash(hash);
      toast({
        title: 'Deposit submitted',
        description: 'Waiting for confirmation...',
      });
    },
    onError: (error) => {
      console.log('Deposit onError called:', error);
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

  const {
    writeContract: withdraw,
    writeContractAsync: withdrawAsync,
    isPending: isWithdrawing,
  } = useWriteContract({
    onSuccess: (hash: `0x${string}`) => {
      console.log('Withdraw onSuccess called with hash:', hash);
      setWithdrawHash(hash);
      toast({
        title: 'Withdrawal submitted',
        description: 'Waiting for confirmation...',
      });
    },
    onError: (error) => {
      console.log('Withdraw onError called:', error);
      toast({
        title: 'Withdrawal Failed',
        description: error.message,
        variant: 'destructive',
      });
      setWithdrawStep('idle');
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
        // Reset the award outcome when starting a new transaction
        setAwardOutcome('pending');
        setAwardResult(null);
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

  // Watch for PrizeAwarded events
  useWatchContractEvent({
    address: contractAddress,
    abi: pumpkinSpiceLatteAbi,
    eventName: 'PrizeAwarded',
    onLogs: (logs) => {
      console.log('🎉 PrizeAwarded event received:', logs);
      if (logs.length > 0) {
        const log = logs[logs.length - 1];
        if (log.args.winner && log.args.amount) {
          setAwardOutcome('success');
          setAwardResult({
            winner: log.args.winner,
            amount: log.args.amount,
          });
          toast({
            title: '🎉 Congratulations!',
            description: `Prize of ${formatUnits(
              log.args.amount,
              6
            )} USDC awarded to ${log.args.winner.slice(
              0,
              6
            )}...${log.args.winner.slice(-4)}!`,
          });
        }
      }
    },
    enabled: Boolean(contractAddress) && Boolean(awardHash),
  });

  // Watch for PrizeNotAwarded events
  useWatchContractEvent({
    address: contractAddress,
    abi: pumpkinSpiceLatteAbi,
    eventName: 'PrizeNotAwarded',
    onLogs: (logs) => {
      console.log('😅 PrizeNotAwarded event received:', logs);
      if (logs.length > 0) {
        const log = logs[logs.length - 1];
        setAwardOutcome('no-prize');
        setAwardResult({
          caller: log.args.caller,
        });
        toast({
          title: '😅 Not this time',
          description:
            'The randomness oracle decided no prize this round. Try again soon!',
        });
      }
    },
    enabled: Boolean(contractAddress) && Boolean(awardHash),
  });

  useEffect(() => {
    if (approvalError) {
      toast({
        title: 'Approval Error',
        description: approvalError.message,
        variant: 'destructive',
      });
      setDepositStep('idle');
    }
  }, [approvalError, toast]);

  useEffect(() => {
    if (depositError) {
      toast({
        title: 'Deposit Error',
        description: depositError.message,
        variant: 'destructive',
      });
      setDepositStep('idle');
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
        console.log(
          'Approval confirmed: Triggering auto-deposit with amount:',
          pendingDepositAmount
        );
        autoDepositTriggeredRef.current = true;
        setDepositStep('depositing');

        // Use async version to get the hash directly
        depositAsync({
          address: contractAddress,
          abi: pumpkinSpiceLatteAbi,
          functionName: 'deposit',
          args: [pendingDepositAmount],
        })
          .then((hash) => {
            console.log('Auto-deposit hash received:', hash);
            setDepositHash(hash);
          })
          .catch((error) => {
            console.error('Auto-deposit failed:', error);
            setDepositStep('idle');
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
            console.log(
              'Polling: Triggering auto-deposit with amount:',
              pendingDepositAmount
            );
            autoDepositTriggeredRef.current = true;
            setDepositStep('depositing');
            depositAsync({
              address: contractAddress,
              abi: pumpkinSpiceLatteAbi,
              functionName: 'deposit',
              args: [pendingDepositAmount],
            })
              .then((hash) => {
                console.log('Polling auto-deposit hash received:', hash);
                setDepositHash(hash);
              })
              .catch((error) => {
                console.error('Polling auto-deposit failed:', error);
                setDepositStep('idle');
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
    console.log('Deposit confirmation check:', {
      isDepositConfirmed,
      depositHash,
    });
    if (isDepositConfirmed) {
      console.log('Deposit confirmed! Setting step to completed');
      // Mark deposit as completed
      setDepositStep('completed');

      toast({
        title: 'Deposit Successful',
        description: 'Your USDC has been deposited.',
      });

      // Wait a moment to show the completed state, then dismiss modal
      setTimeout(() => {
        console.log('Dismissing modal after completion');
        setIsRightStackOpen(false);
        setDepositStep('idle');
        setAmount('');
        setDepositHash(undefined);
        setPendingDepositAmount(undefined);
        autoDepositTriggeredRef.current = false;
        refetchAllowance();

        // Refresh user balance and other contract data
        if (address) {
          // Refetch user's PSL balance
          refetchUserBalance();
          // Refetch win probability
          refetchWinProb();
        }
      }, 1500);
    }
  }, [
    isDepositConfirmed,
    depositHash,
    refetchAllowance,
    refetchUserBalance,
    refetchWinProb,
    toast,
    address,
  ]);

  useEffect(() => {
    console.log('Withdraw confirmation check:', {
      isWithdrawConfirmed,
      withdrawHash,
    });
    if (isWithdrawConfirmed) {
      console.log('Withdraw confirmed! Setting step to completed');
      // Mark withdraw as completed
      setWithdrawStep('completed');

      toast({
        title: 'Withdrawal Successful',
        description: 'Your USDC has been withdrawn.',
      });

      // Wait a moment to show the completed state, then dismiss modal
      setTimeout(() => {
        console.log('Dismissing withdraw modal after completion');
        setIsRightStackOpen(false);
        setWithdrawStep('idle');
        setAmount('');
        setWithdrawHash(undefined);

        // Refresh user balance and other contract data
        if (address) {
          // Refetch user's PSL balance
          refetchUserBalance();
          // Refetch win probability
          refetchWinProb();
        }
      }, 1500);
    }
  }, [
    isWithdrawConfirmed,
    withdrawHash,
    refetchUserBalance,
    refetchWinProb,
    toast,
    address,
  ]);

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
    if (!isConnected) {
      openConnectModal?.();
      return;
    }
    setActiveAction(action);
    setDepositStep('idle');
    setWithdrawStep('idle');
    setIsRightStackOpen(true);
  };

  // Track approval step
  useEffect(() => {
    console.log('Approval step tracking:', {
      isApproving,
      isApprovalConfirmed,
      depositStep,
    });

    if (isApproving) {
      setDepositStep('approving');
    }

    if (
      isApprovalConfirmed &&
      (depositStep === 'approving' || depositStep === 'idle')
    ) {
      setDepositStep('approved');
    }
  }, [isApproving, isApprovalConfirmed, depositStep]);

  // Track deposit step
  useEffect(() => {
    console.log('Deposit step tracking:', {
      isDepositing,
      isConfirmingDeposit,
      depositStep,
    });

    if (
      (isDepositing || isConfirmingDeposit) &&
      (depositStep === 'approved' || depositStep === 'idle')
    ) {
      setDepositStep('depositing');
    }
  }, [isDepositing, isConfirmingDeposit, depositStep]);

  // Debug: Log all step changes
  useEffect(() => {
    console.log('Step changed to:', depositStep);
  }, [depositStep]);

  // Track withdraw step
  useEffect(() => {
    console.log('Withdraw step tracking:', {
      isWithdrawing,
      isConfirmingWithdraw,
      withdrawStep,
    });

    if ((isWithdrawing || isConfirmingWithdraw) && withdrawStep === 'idle') {
      setWithdrawStep('withdrawing');
    }
  }, [isWithdrawing, isConfirmingWithdraw, withdrawStep]);

  // Debug: Log all withdraw step changes
  useEffect(() => {
    console.log('Withdraw step changed to:', withdrawStep);
  }, [withdrawStep]);

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
    setDepositStep('idle');
    setWithdrawStep('idle');
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
          setDepositStep('approving');
          approve({
            address: currentTokenAddress,
            abi: usdcAbi,
            functionName: 'approve',
            args: [contractAddress, parsedAmount],
          });
        } else {
          setPendingDepositAmount(undefined);
          setDepositStep('depositing');
          deposit({
            address: contractAddress,
            abi: pumpkinSpiceLatteAbi,
            functionName: 'deposit',
            args: [parsedAmount],
          });
        }
      } else {
        // withdraw
        setWithdrawStep('withdrawing');
        withdrawAsync({
          address: contractAddress,
          abi: pumpkinSpiceLatteAbi,
          functionName: 'withdraw',
          args: [parsedAmount],
        })
          .then((hash) => {
            console.log('Withdraw hash received:', hash);
            setWithdrawHash(hash);
          })
          .catch((error) => {
            console.error('Withdraw failed:', error);
            setWithdrawStep('idle');
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
    <div className={`${isMobile ? 'h-full' : 'h-full'} flex flex-col`}>
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
            isMobile ? '' : 'grid grid-cols-2 gap-2 max-w-4xl mx-auto'
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
                  $
                  {userPSLBalance.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
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
            } text-left`}
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
                Probability of winner being drawn
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
                className='w-full py-3 text-base border-gray-400 text-orange-600 hover:bg-orange-100 hover:text-orange-600 rounded-lg'
              >
                {isTryLuckBusy ? 'Rolling…' : '🍀 Try your luck'}
              </Button>
            </div>

            {/* Award Result Display */}
            {awardOutcome && (
              <div className='mt-3 p-3 rounded-lg border'>
                {awardOutcome === 'pending' && (
                  <div className='text-center'>
                    <div className='text-2xl mb-2'>🎲</div>
                    <div className='text-sm font-medium text-blue-700'>
                      Rolling the dice...
                    </div>
                    <div className='text-xs text-muted-foreground mt-1'>
                      Waiting for the randomness oracle
                    </div>
                  </div>
                )}
                {awardOutcome === 'success' &&
                  awardResult &&
                  awardResult.winner &&
                  awardResult.amount && (
                    <div className='text-center'>
                      <div className='text-2xl mb-2'>🎉</div>
                      <div className='text-sm font-medium text-green-700'>
                        Prize Awarded!
                      </div>
                      <div className='text-xs text-muted-foreground mt-1'>
                        {formatUnits(awardResult.amount, 6)} USDC won by{' '}
                        <span className='font-mono'>
                          {awardResult.winner.slice(0, 6)}...
                          {awardResult.winner.slice(-4)}
                        </span>
                      </div>
                    </div>
                  )}
                {awardOutcome === 'no-prize' && (
                  <div className='text-center'>
                    <div className='text-2xl mb-2'>😅</div>
                    <div className='text-sm font-medium text-orange-700'>
                      No Prize This Round
                    </div>
                    <div className='text-xs text-muted-foreground mt-1'>
                      The randomness oracle decided it wasn't time yet
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons - Desktop: Below content, Mobile: At bottom */}
      <div className={`${isMobile ? 'p-2 mb-20' : 'px-4 pt-12'}`}>
        <div
          className={`flex ${isMobile ? 'gap-1' : 'gap-2 max-w-4xl mx-auto'}`}
        >
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
              disabled={userPSLBalance === 0}
              className='w-full h-20 text-lg border border-orange-400 text-orange-500 hover:bg-orange-100 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed'
            >
              {userPSLBalance === 0 ? (
                <>
                  Nothing to
                  <br />
                  withdraw
                </>
              ) : (
                '💰 Withdraw'
              )}
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
                  {activeAction === 'deposit' ? '💸 Deposit' : '💰 Withdraw'}
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
                    USDC amount
                  </label>
                  <div className='relative'>
                    <Input
                      type='number'
                      placeholder='0'
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      ref={amountInputRef}
                      className='text-4xl font-bold text-left h-16 border-0 rounded-xl focus:border focus:border-orange-500 focus:border-opacity-50 focus:ring-0 pr-32 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
                    />
                    <div className='absolute right-4 top-1/2 transform -translate-y-1/2 text-right'>
                      <div className='text-xs text-gray-500'>Balance</div>
                      <div className='text-sm font-medium text-gray-700'>
                        {activeAction === 'deposit'
                          ? walletUSDCDisplay.toLocaleString()
                          : userPSLBalance.toLocaleString()}
                      </div>
                    </div>
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

                  {/* Deposit Step Indicators */}
                  {activeAction === 'deposit' && depositStep !== 'idle' && (
                    <div className='space-y-2 pt-2'>
                      <div className='flex items-center gap-2 text-sm'>
                        {depositStep === 'approving' ? (
                          <div className='w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin'></div>
                        ) : depositStep === 'approved' ||
                          depositStep === 'depositing' ||
                          depositStep === 'completed' ? (
                          <span className='text-green-600'>✅</span>
                        ) : (
                          <span className='text-gray-400'>☕</span>
                        )}
                        <span
                          className={
                            depositStep === 'approved' ||
                            depositStep === 'depositing' ||
                            depositStep === 'completed'
                              ? 'text-green-600'
                              : 'text-gray-600'
                          }
                        >
                          Approve spending
                        </span>
                      </div>

                      <div className='flex items-center gap-2 text-sm'>
                        {depositStep === 'depositing' ? (
                          <div className='w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin'></div>
                        ) : depositStep === 'completed' ? (
                          <span className='text-green-600'>✅</span>
                        ) : (
                          <span className='text-gray-400'>☕</span>
                        )}
                        <span
                          className={
                            depositStep === 'completed'
                              ? 'text-green-600'
                              : 'text-gray-600'
                          }
                        >
                          Execute deposit
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Withdraw Step Indicators */}
                  {activeAction === 'withdraw' && withdrawStep !== 'idle' && (
                    <div className='space-y-2 pt-2'>
                      <div className='flex items-center gap-2 text-sm'>
                        {withdrawStep === 'withdrawing' ? (
                          <div className='w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin'></div>
                        ) : withdrawStep === 'completed' ? (
                          <span className='text-green-600'>✅</span>
                        ) : (
                          <span className='text-gray-400'>☕</span>
                        )}
                        <span
                          className={
                            withdrawStep === 'completed'
                              ? 'text-green-600'
                              : 'text-gray-600'
                          }
                        >
                          Execute withdrawal
                        </span>
                      </div>
                    </div>
                  )}
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
                {activeAction === 'deposit' ? '💸 Deposit' : '💰 Withdraw'}
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
                  USDC amount
                </label>
                <div className='relative'>
                  <Input
                    type='number'
                    placeholder='0'
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    ref={amountInputRef}
                    className='text-4xl font-bold text-left h-16 border-0 rounded-xl focus:border focus:border-orange-500 focus:border-opacity-50 focus:ring-0 pr-32 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
                  />
                  <div className='absolute right-4 top-1/2 transform -translate-y-1/2 text-right'>
                    <div className='text-xs text-gray-500'>Balance</div>
                    <div className='text-sm font-medium text-gray-700'>
                      {activeAction === 'deposit'
                        ? walletUSDCDisplay.toLocaleString()
                        : userPSLBalance.toLocaleString()}
                    </div>
                  </div>
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

                {/* Deposit Step Indicators */}
                {activeAction === 'deposit' && depositStep !== 'idle' && (
                  <div className='space-y-2 pt-2'>
                    <div className='flex items-center gap-2 text-sm'>
                      {depositStep === 'approving' ? (
                        <div className='w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin'></div>
                      ) : depositStep === 'approved' ||
                        depositStep === 'depositing' ||
                        depositStep === 'completed' ? (
                        <span className='text-green-600'>✅</span>
                      ) : (
                        <span className='text-gray-400'>☕</span>
                      )}
                      <span
                        className={
                          depositStep === 'approved' ||
                          depositStep === 'depositing' ||
                          depositStep === 'completed'
                            ? 'text-green-600'
                            : 'text-gray-600'
                        }
                      >
                        Approve spending
                      </span>
                    </div>

                    <div className='flex items-center gap-2 text-sm'>
                      {depositStep === 'depositing' ? (
                        <div className='w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin'></div>
                      ) : depositStep === 'completed' ? (
                        <span className='text-green-600'>✅</span>
                      ) : (
                        <span className='text-gray-400'>☕</span>
                      )}
                      <span className='text-gray-600'>Execute deposit</span>
                    </div>
                  </div>
                )}

                {/* Withdraw Step Indicators */}
                {activeAction === 'withdraw' && withdrawStep !== 'idle' && (
                  <div className='space-y-2 pt-2'>
                    <div className='flex items-center gap-2 text-sm'>
                      {withdrawStep === 'withdrawing' ? (
                        <div className='w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin'></div>
                      ) : withdrawStep === 'completed' ? (
                        <span className='text-green-600'>✅</span>
                      ) : (
                        <span className='text-gray-400'>☕</span>
                      )}
                      <span
                        className={
                          withdrawStep === 'completed'
                            ? 'text-green-600'
                            : 'text-gray-600'
                        }
                      >
                        Execute withdrawal
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PSLHome;
