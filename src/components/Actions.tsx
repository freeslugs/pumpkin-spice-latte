import { useState, useMemo, useEffect, useRef } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { pumpkinSpiceLatteAddress, pumpkinSpiceLatteAbi, CONTRACTS } from '@/contracts/PumpkinSpiceLatte';
import { usdcAddress, usdcAbi } from '@/contracts/USDC';
import { isAddress, formatUnits, parseUnits } from 'viem';
import { useToast } from '@/components/ui/use-toast';

const Actions = () => {
  const { address, isConnected, chain } = useAccount();
  const { toast } = useToast();
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');

  // Check if we're on a supported network
  const isSupportedNetwork = chain && CONTRACTS[chain.id as keyof typeof CONTRACTS];
  const contractAddress = isSupportedNetwork ? CONTRACTS[chain.id as keyof typeof CONTRACTS].pumpkinSpiceLatte : pumpkinSpiceLatteAddress;
  const currentTokenAddress = isSupportedNetwork ? (CONTRACTS as any)[chain!.id].usdc : usdcAddress;

  const { data: allowance = 0n, refetch: refetchAllowance } = useReadContract({
    address: currentTokenAddress,
    abi: usdcAbi,
    functionName: 'allowance',
    args: [address, contractAddress],
    query: {
      enabled: isConnected && !!address && !!isSupportedNetwork,
    },
  });

  const { data: walletBalance = 0n } = useReadContract({
    address: currentTokenAddress,
    abi: usdcAbi,
    functionName: 'balanceOf',
    args: [address],
    query: {
      enabled: isConnected && !!address && !!isSupportedNetwork,
      refetchInterval: 5000,
    },
  } as any);

  const [approvalHash, setApprovalHash] = useState<`0x${string}` | undefined>(undefined);
  const [depositHash, setDepositHash] = useState<`0x${string}` | undefined>(undefined);
  const [pendingDepositAmount, setPendingDepositAmount] = useState<bigint | undefined>(undefined);
  const autoDepositTriggeredRef = useRef(false);

  const { writeContract: approve, isPending: isApproving } = useWriteContract({
    onSuccess: (hash: `0x${string}`) => {
      setApprovalHash(hash);
      toast({
        title: 'Approval submitted',
        description: 'Waiting for on-chain confirmation...'
      });
    },
    onError: (error) => {
      toast({
        title: 'Approval Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const { isLoading: isConfirmingApproval, isSuccess: isApprovalConfirmed } = useWaitForTransactionReceipt({
    hash: approvalHash,
  });

  // Declare deposit hook BEFORE any effects that reference it
  const { writeContract: deposit, isPending: isDepositing } = useWriteContract({
    onSuccess: (hash: `0x${string}`) => {
      setDepositHash(hash);
      toast({ title: 'Deposit submitted', description: 'Waiting for on-chain confirmation...' });
    },
    onError: (error) => {
      toast({
        title: 'Deposit Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  useEffect(() => {
    if (isApprovalConfirmed) {
      refetchAllowance();
      toast({ title: 'Approval Confirmed', description: 'You can now deposit your USDC.' });
      setApprovalHash(undefined);
      // Auto-trigger deposit once after approval confirmation
      if (!autoDepositTriggeredRef.current && pendingDepositAmount && isAddress(contractAddress)) {
        autoDepositTriggeredRef.current = true;
        deposit({
          address: contractAddress,
          abi: pumpkinSpiceLatteAbi,
          functionName: 'deposit',
          args: [pendingDepositAmount],
        });
      }
    }
  }, [isApprovalConfirmed, refetchAllowance, toast, pendingDepositAmount, contractAddress, deposit]);

  const { isLoading: isConfirmingDeposit, isSuccess: isDepositConfirmed } = useWaitForTransactionReceipt({
    hash: depositHash,
  });

  useEffect(() => {
    if (isDepositConfirmed) {
      toast({ title: 'Deposit Successful', description: 'Your USDC has been deposited.' });
      setDepositAmount('');
      setDepositHash(undefined);
      setPendingDepositAmount(undefined);
      autoDepositTriggeredRef.current = false;
    }
  }, [isDepositConfirmed, toast]);

  const { writeContract: withdraw, isPending: isWithdrawing } = useWriteContract({
    onSuccess: () => {
      toast({
        title: 'Withdrawal Submitted',
        description: 'Waiting for on-chain confirmation...'
      });
      setWithdrawAmount('');
    },
    onError: (error) => {
      toast({
        title: 'Withdrawal Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const parsedDepositAmount = useMemo(() => {
    if (!depositAmount || Number(depositAmount) <= 0) return 0n;
    try { return parseUnits(depositAmount, 6); } catch { return 0n; }
  }, [depositAmount]);

  const parsedWithdrawAmount = useMemo(() => {
    if (!withdrawAmount || Number(withdrawAmount) <= 0) return 0n;
    try { return parseUnits(withdrawAmount, 6); } catch { return 0n; }
  }, [withdrawAmount]);

  const handleDeposit = () => {
    if (parsedDepositAmount === 0n) return;
    if (!isAddress(contractAddress)) return;

    if (allowance < parsedDepositAmount) {
      setPendingDepositAmount(parsedDepositAmount);
      autoDepositTriggeredRef.current = false;
      approve({
        address: currentTokenAddress,
        abi: usdcAbi,
        functionName: 'approve',
        args: [contractAddress, parsedDepositAmount],
      });
    } else {
      setPendingDepositAmount(undefined);
      deposit({
        address: contractAddress,
        abi: pumpkinSpiceLatteAbi,
        functionName: 'deposit',
        args: [parsedDepositAmount],
      });
    }
  };

  const handleWithdraw = () => {
    if (parsedWithdrawAmount === 0n) return;
    if (!isAddress(contractAddress)) return;
    withdraw({
      address: contractAddress,
      abi: pumpkinSpiceLatteAbi,
      functionName: 'withdraw',
      args: [parsedWithdrawAmount],
    });
  };

  const needsApproval = isConnected && parsedDepositAmount > 0n && allowance < parsedDepositAmount;

  const isPrimaryDisabled = !isConnected || !isSupportedNetwork || isApproving || isDepositing || isConfirmingApproval || isConfirmingDeposit || parsedDepositAmount === 0n;

  const primaryLabel = isApproving
    ? 'Approve in wallet...'
    : isConfirmingApproval
      ? 'Confirming approval...'
      : isDepositing
        ? 'Deposit in wallet...'
        : isConfirmingDeposit
          ? 'Confirming deposit...'
          : needsApproval
            ? 'Approve USDC'
            : 'Deposit USDC';

  const step1Complete = !needsApproval || isApprovalConfirmed || allowance >= parsedDepositAmount;
  const step2Complete = isDepositConfirmed;
  const progress = step1Complete && step2Complete ? 100 : step1Complete ? 50 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="inline-block">☕️</span>
          Manage Your Funds
        </CardTitle>
        <CardDescription>Deposit to enter the prize draw or withdraw your principal at any time.</CardDescription>
        {!isSupportedNetwork && isConnected && (
          <div className="text-sm text-amber-600 bg-amber-50 p-2 rounded">
            ⚠️ Please switch to a supported network to interact with the contract
          </div>
        )}
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="deposit">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="deposit">Deposit</TabsTrigger>
            <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
          </TabsList>
          <TabsContent value="deposit" className="pt-4">
            <div className="space-y-3">
              <Input
                type="number"
                inputMode="decimal"
                placeholder="Amount in USDC"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
              />
              <div className="text-xs text-muted-foreground text-center">Wallet balance: {formatUnits(walletBalance as bigint, 6)} USDC</div>

              {/* Approval status */}
              <div className="text-xs rounded border p-2 flex items-center justify-between">
                <span>Current approval to PSL</span>
                <span className="font-medium">{formatUnits(allowance, 6)} USDC</span>
              </div>

              {/* Stepper / Progress */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className={`flex items-center gap-2 ${step1Complete ? 'text-green-600' : (isApproving || isConfirmingApproval) ? 'text-amber-600' : 'text-muted-foreground'}`}>
                    <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: step1Complete ? '#16a34a' : (isApproving || isConfirmingApproval) ? '#d97706' : '#9ca3af' }} />
                    <span>1. Approve</span>
                  </div>
                  <div className={`flex items-center gap-2 ${step2Complete ? 'text-green-600' : (isDepositing || isConfirmingDeposit) ? 'text-amber-600' : 'text-muted-foreground'}`}>
                    <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: step2Complete ? '#16a34a' : (isDepositing || isConfirmingDeposit) ? '#d97706' : '#9ca3af' }} />
                    <span>2. Deposit</span>
                  </div>
                </div>
                <div className="w-full h-2 bg-muted rounded overflow-hidden">
                  <div className="h-full bg-orange-500 transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>

              <Button
                className="w-full"
                disabled={isPrimaryDisabled}
                onClick={handleDeposit}
              >
                {primaryLabel}
              </Button>
              <p className="text-xs text-muted-foreground text-center">{needsApproval ? 'You must approve USDC before depositing.' : 'Ready to deposit.'}</p>
            </div>
          </TabsContent>
          <TabsContent value="withdraw" className="pt-4">
            <div className="space-y-3">
              <Input
                type="number"
                inputMode="decimal"
                placeholder="Amount in USDC"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
              />
              <div className="text-xs text-muted-foreground text-center">Wallet balance: {formatUnits(walletBalance as bigint, 6)} USDC</div>
              <Button
                variant="secondary"
                className="w-full"
                disabled={!isConnected || !isSupportedNetwork || isWithdrawing || parsedWithdrawAmount === 0n}
                onClick={handleWithdraw}
              >
                {isWithdrawing ? 'Withdrawing...' : 'Withdraw USDC'}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default Actions;
