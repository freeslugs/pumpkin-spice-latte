import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useBalance, useBlockNumber } from 'wagmi';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wallet, Activity, Hash } from 'lucide-react';

const DAppHome = () => {
  const { address, isConnected, chain } = useAccount();
  const { data: balance } = useBalance({ address });
  const { data: blockNumber } = useBlockNumber();

  return (
    <div className='container mx-auto p-6 space-y-8'>
      {/* Header */}
      <div className='text-center space-y-4'>
        <h1 className='text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent'>
          Welcome to Your DApp
        </h1>
        <p className='text-lg text-muted-foreground max-w-2xl mx-auto'>
          A modern Web3 application built with React, TypeScript, Wagmi, and
          RainbowKit
        </p>
      </div>

      {/* Connect Wallet */}
      <div className='flex justify-center'>
        <ConnectButton />
      </div>

      {/* Wallet Information */}
      {isConnected && (
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>
                Wallet Address
              </CardTitle>
              <Wallet className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold truncate'>
                {address
                  ? `${address.slice(0, 6)}...${address.slice(-4)}`
                  : 'N/A'}
              </div>
              <p className='text-xs text-muted-foreground'>
                Your connected wallet address
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>Balance</CardTitle>
              <Activity className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>
                {balance
                  ? `${parseFloat(balance.formatted).toFixed(4)} ${
                      balance.symbol
                    }`
                  : '0.0000 ETH'}
              </div>
              <p className='text-xs text-muted-foreground'>
                Your wallet balance
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>Network</CardTitle>
              <Hash className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>
                {chain?.name || 'Unknown'}
              </div>
              <p className='text-xs text-muted-foreground'>
                Current network: {chain?.id || 'N/A'}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Block Information */}
      <Card>
        <CardHeader>
          <CardTitle>Latest Block</CardTitle>
          <CardDescription>Real-time blockchain data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className='flex items-center space-x-2'>
            <Badge variant='outline'>
              Block #{blockNumber?.toString() || 'Loading...'}
            </Badge>
            <span className='text-sm text-muted-foreground'>
              Latest block number from the blockchain
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Features */}
      <Card>
        <CardHeader>
          <CardTitle>DApp Features</CardTitle>
          <CardDescription>What's included in this template</CardDescription>
        </CardHeader>
        <CardContent>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div className='space-y-2'>
              <h4 className='font-semibold'>🔗 Wallet Connection</h4>
              <p className='text-sm text-muted-foreground'>
                Connect to multiple wallets with RainbowKit
              </p>
            </div>
            <div className='space-y-2'>
              <h4 className='font-semibold'>🌐 Multi-chain Support</h4>
              <p className='text-sm text-muted-foreground'>
                Support for Ethereum, Polygon, Optimism, and more
              </p>
            </div>
            <div className='space-y-2'>
              <h4 className='font-semibold'>📊 Real-time Data</h4>
              <p className='text-sm text-muted-foreground'>
                Live blockchain data with automatic updates
              </p>
            </div>
            <div className='space-y-2'>
              <h4 className='font-semibold'>🎨 Modern UI</h4>
              <p className='text-sm text-muted-foreground'>
                Beautiful components with shadcn/ui and Tailwind CSS
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DAppHome;
