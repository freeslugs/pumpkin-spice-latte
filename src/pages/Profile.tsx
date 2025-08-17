import React from 'react';
import { useReadContract, useAccount, useBalance } from 'wagmi';
import {
  pumpkinSpiceLatteAddress,
  pumpkinSpiceLatteAbi,
  CONTRACTS,
} from '../contracts/PumpkinSpiceLatte';
import { usdcAddress, usdcAbi } from '../contracts/USDC';
import { formatUnits } from 'viem';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import { AlertCircle, Copy, ExternalLink } from 'lucide-react';
import { useIsMobile } from '../hooks/use-mobile';

const Profile = () => {
  const { isConnected, chain, address } = useAccount();
  const isMobile = useIsMobile();

  // Check if we're on a supported network
  const isSupportedNetwork =
    chain && CONTRACTS[chain.id as keyof typeof CONTRACTS];
  const targetChainId = isSupportedNetwork ? chain!.id : 114; // Default to Coston2
  const contractAddress =
    CONTRACTS[targetChainId as keyof typeof CONTRACTS]?.pumpkinSpiceLatte ??
    pumpkinSpiceLatteAddress;

  // Fetch USDC balance
  const { data: usdcBalanceData } = useBalance({
    address: address as `0x${string}`,
    token: usdcAddress as `0x${string}`,
    chainId: targetChainId,
    query: {
      refetchInterval: 30000,
      enabled: isConnected && !!address,
    },
  });

  // Fetch user's PSL deposits
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

  const usdcBalance = usdcBalanceData
    ? parseFloat(formatUnits(usdcBalanceData.value, usdcBalanceData.decimals))
    : 0;

  const userPSLBalance = userPSLBalanceData
    ? parseFloat(formatUnits(userPSLBalanceData as bigint, 6))
    : 0;

  // Calculate user's yield (mock for now)
  const userYield = userPSLBalance * 0.025; // 2.5% yield

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getAddressExplorerUrl = (chainId: number, address: string) => {
    if (chainId === 114) {
      return `https://coston2-explorer.flare.network/address/${address}`;
    }
    return `https://etherscan.io/address/${address}`;
  };

  if (!isConnected) {
    return (
      <div className={`p-4 text-center ${isMobile ? '' : 'max-w-2xl mx-auto'}`}>
        <div className='text-6xl mb-4'>🔒</div>
        <h1 className='text-2xl font-bold text-foreground mb-2'>
          Connect Your Wallet
        </h1>
        <p className='text-muted-foreground'>
          Please connect your wallet to view your profile information.
        </p>
      </div>
    );
  }

  return (
    <div className={`p-4 space-y-6 ${isMobile ? '' : 'max-w-4xl mx-auto'}`}>
      {/* Profile Header */}
      <div className='text-center'>
        <div className='w-20 h-20 bg-orange-500 rounded-full flex items-center justify-center mx-auto mb-4'>
          <span className='text-3xl'>👤</span>
        </div>
        <h1
          className={`font-bold text-foreground ${
            isMobile ? 'text-3xl' : 'text-4xl'
          }`}
        >
          Your Profile
        </h1>
        <p className='text-muted-foreground mt-2'>
          Manage your account and view your balances
        </p>
      </div>

      {/* Network Status */}
      {!isSupportedNetwork && (
        <div className='p-4 rounded-lg border bg-amber-50 border-amber-200 text-amber-800'>
          <div className='flex items-center gap-3'>
            <AlertCircle className='h-5 w-5 text-amber-600' />
            <div>
              <p className='font-medium'>Network not supported</p>
              <p className='text-sm'>
                Please switch to Coston2 (Flare testnet) for full functionality
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className={`grid gap-6 ${isMobile ? 'grid-cols-1' : 'grid-cols-2'}`}>
        {/* Wallet Information */}
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <span className='text-2xl'>💳</span>
              Wallet Information
            </CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div>
              <label className='text-sm font-medium text-muted-foreground'>
                Address
              </label>
              <div className='flex items-center gap-2 mt-1'>
                <code className='text-sm bg-muted px-2 py-1 rounded flex-1'>
                  {address?.slice(0, 6)}...{address?.slice(-4)}
                </code>
                <button
                  onClick={() => copyToClipboard(address || '')}
                  className='p-1 hover:bg-muted rounded'
                >
                  <Copy className='w-4 h-4' />
                </button>
                <a
                  href={getAddressExplorerUrl(targetChainId, address || '')}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='p-1 hover:bg-muted rounded'
                >
                  <ExternalLink className='w-4 h-4' />
                </a>
              </div>
            </div>
            <div>
              <label className='text-sm font-medium text-muted-foreground'>
                Network
              </label>
              <p className='text-sm mt-1'>{chain?.name || 'Unknown'}</p>
            </div>
          </CardContent>
        </Card>

        {/* Balances */}
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <span className='text-2xl'>💰</span>
              Balances
            </CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='flex justify-between items-center'>
              <span className='text-sm text-muted-foreground'>
                USDC Balance
              </span>
              <span className='font-bold text-lg'>
                {usdcBalance.toLocaleString()} USDC
              </span>
            </div>
            <div className='flex justify-between items-center'>
              <span className='text-sm text-muted-foreground'>
                PSL Deposits
              </span>
              <span className='font-bold text-lg'>
                {userPSLBalance.toLocaleString()} USDC
              </span>
            </div>
            <div className='flex justify-between items-center'>
              <span className='text-sm text-muted-foreground'>
                Generated Yield
              </span>
              <span className='font-bold text-lg text-green-600'>
                {userYield.toLocaleString()} USDC
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Info */}
      <div className={`grid gap-6 ${isMobile ? 'grid-cols-1' : 'grid-cols-2'}`}>
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <span className='text-2xl'>📊</span>
              Account Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='space-y-3 text-sm text-muted-foreground'>
              <p>
                <strong>Total Value:</strong> $
                {(usdcBalance + userPSLBalance).toLocaleString()} USDC
              </p>
              <p>
                <strong>Active Deposits:</strong>{' '}
                {userPSLBalance > 0 ? 'Yes' : 'No'}
              </p>
              <p>
                <strong>Yield Rate:</strong> 2.5% APY
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <span className='text-2xl'>🎯</span>
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='space-y-3 text-sm text-muted-foreground'>
              <p>• Deposit USDC to earn lottery tickets</p>
              <p>• Withdraw your principal anytime</p>
              <p>• View lottery history and winners</p>
              <p>• Check pool statistics</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Profile;
