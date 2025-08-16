import { useState, useMemo } from 'react';
import { useAccount, useReadContract, useWriteContract } from 'wagmi';
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

  const { writeContract: approve, isPending: isApproving } = useWriteContract({
    onSuccess: () => {
      toast({
        title: 'Approval Successful',
        description: 'You can now deposit your USDC.',
      });
      refetchAllowance();
    },
    onError: (error) => {
      toast({
        title: 'Approval Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const { writeContract: deposit, isPending: isDepositing } = useWriteContract({
    onSuccess: () => {
      toast({
        title: 'Deposit Successful',
        description: 'Your USDC has been deposited.',
      });
      setDepositAmount('');
    },
    onError: (error) => {
      toast({
        title: 'Deposit Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const { writeContract: withdraw, isPending: isWithdrawing } = useWriteContract({
    onSuccess: () => {
      toast({
        title: 'Withdrawal Successful',
        description: 'Your USDC has been withdrawn.',
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
      approve({
        address: currentTokenAddress,
        abi: usdcAbi,
        functionName: 'approve',
        args: [contractAddress, parsedDepositAmount],
      });
    } else {
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
            ⚠️ Please switch to Sepolia testnet to interact with the contract
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
              <Button
                className="w-full"
                disabled={!isConnected || !isSupportedNetwork || isApproving || isDepositing || parsedDepositAmount === 0n}
                onClick={handleDeposit}
              >
                {isApproving ? 'Approving...' : isDepositing ? 'Depositing...' : needsApproval ? 'Approve USDC' : 'Deposit USDC'}
              </Button>
              <p className="text-xs text-muted-foreground text-center">You may be asked to approve USDC before depositing.</p>
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
