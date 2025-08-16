import { useState } from 'react';
import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { pumpkinSpiceLatteAddress, pumpkinSpiceLatteAbi, CONTRACTS } from '@/contracts/PumpkinSpiceLatte';
import { wethAddress, wethAbi } from '@/contracts/WETH';
import { parseEther } from 'viem';
import { useToast } from '@/components/ui/use-toast';

const Actions = () => {
  const { address, isConnected, chain } = useAccount();
  const { toast } = useToast();
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');

  // Check if we're on a supported network
  const isSupportedNetwork = chain && CONTRACTS[chain.id as keyof typeof CONTRACTS];
  const contractAddress = isSupportedNetwork ? CONTRACTS[chain.id as keyof typeof CONTRACTS].pumpkinSpiceLatte : pumpkinSpiceLatteAddress;
  const currentWethAddress = isSupportedNetwork ? CONTRACTS[chain.id as keyof typeof CONTRACTS].weth : wethAddress;

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: currentWethAddress,
    abi: wethAbi,
    functionName: 'allowance',
    args: [address, contractAddress],
    query: {
        enabled: isConnected && !!address && isSupportedNetwork,
    }
  });

  const { writeContract: approve, isPending: isApproving } = useWriteContract({
    onSuccess: () => {
        toast({
            title: "Approval Successful",
            description: "You can now deposit your WETH.",
        });
        refetchAllowance();
    },
    onError: (error) => {
        toast({
            title: "Approval Failed",
            description: error.message,
            variant: "destructive",
        });
    }
  });

  const { writeContract: deposit, isPending: isDepositing } = useWriteContract({
    onSuccess: () => {
        toast({
            title: "Deposit Successful",
            description: "Your WETH has been deposited.",
        });
        setDepositAmount('');
    },
    onError: (error) => {
        toast({
            title: "Deposit Failed",
            description: error.message,
            variant: "destructive",
        });
    }
  });

  const { writeContract: withdraw, isPending: isWithdrawing } = useWriteContract({
    onSuccess: () => {
        toast({
            title: "Withdrawal Successful",
            description: "Your WETH has been withdrawn.",
        });
        setWithdrawAmount('');
    },
    onError: (error) => {
        toast({
            title: "Withdrawal Failed",
            description: error.message,
            variant: "destructive",
        });
    }
  });

  const handleDeposit = () => {
    const amount = parseEther(depositAmount);
    
    if (allowance < amount) {
        approve({
            address: currentWethAddress,
            abi: wethAbi,
            functionName: 'approve',
            args: [contractAddress, amount],
        });
    } else {
        deposit({
            address: contractAddress,
            abi: pumpkinSpiceLatteAbi,
            functionName: 'deposit',
            args: [amount],
        });
    }
  };

  const handleWithdraw = () => {
    const amount = parseEther(withdrawAmount);
    withdraw({
        address: contractAddress,
        abi: pumpkinSpiceLatteAbi,
        functionName: 'withdraw',
        args: [amount],
    });
  };

  const needsApproval = isConnected && allowance < parseEther(depositAmount || '0');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manage Your Funds</CardTitle>
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
            <div className="space-y-4">
              <Input 
                type="number" 
                placeholder="Amount in WETH" 
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
              />
              <Button 
                className="w-full" 
                disabled={!isConnected || !isSupportedNetwork || isApproving || isDepositing}
                onClick={handleDeposit}
              >
                {isApproving ? "Approving..." : isDepositing ? "Depositing..." : needsApproval ? "Approve WETH" : "Deposit WETH"}
              </Button>
            </div>
          </TabsContent>
          <TabsContent value="withdraw" className="pt-4">
            <div className="space-y-4">
              <Input 
                type="number" 
                placeholder="Amount in WETH" 
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
              />
              <Button 
                variant="secondary" 
                className="w-full" 
                disabled={!isConnected || !isSupportedNetwork || isWithdrawing}
                onClick={handleWithdraw}
              >
                {isWithdrawing ? "Withdrawing..." : "Withdraw WETH"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default Actions;
