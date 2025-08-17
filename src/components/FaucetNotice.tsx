import React, { useEffect, useState } from 'react'
import { useAccount, useBalance } from 'wagmi'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { AlertCircle, X } from 'lucide-react'
import { CONTRACTS } from '@/contracts/PumpkinSpiceLatte'

const LOCAL_STORAGE_KEY = 'faucetNoticeDismissed'

const FaucetNotice: React.FC = () => {
  const { address, isConnected, chain } = useAccount()
  const [dismissed, setDismissed] = useState<boolean>(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY)
      setDismissed(stored === 'true')
    } catch {
      // ignore
    }
  }, [])

  const handleDismiss = () => {
    setDismissed(true)
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, 'true')
    } catch {
      // ignore
    }
  }

  const isSupportedNetwork = chain && (CONTRACTS as any)[String(chain.id)]
  const targetChainId = isSupportedNetwork ? chain!.id : 747474
  const usdcAddress = (CONTRACTS as any)[targetChainId]?.usdc as `0x${string}` | undefined

  const { data: nativeBalanceData, isLoading: nativeLoading } = useBalance({
    address,
    chainId: isSupportedNetwork ? chain!.id : undefined,
    query: {
      enabled: isConnected && !!address && !!isSupportedNetwork,
      refetchInterval: 60_000,
    },
  })

  const { data: usdcBalanceData, isLoading: usdcLoading } = useBalance({
    address,
    token: usdcAddress,
    chainId: targetChainId,
    query: {
      enabled: isConnected && !!address && !!usdcAddress,
      refetchInterval: 60_000,
    },
  })

  const nativeZero = nativeBalanceData ? nativeBalanceData.value === 0n : false
  const usdcZero = usdcBalanceData ? usdcBalanceData.value === 0n : false

  const shouldShow = !dismissed && (
    !isConnected ||
    !isSupportedNetwork ||
    (isConnected && !!isSupportedNetwork && !nativeLoading && !usdcLoading && (nativeZero || usdcZero))
  )

  if (!shouldShow) return null

  return (
    <div className='max-w-5xl mx-auto p-3'>
      <Alert className='relative bg-amber-50 border-amber-200 text-amber-900'>
        <AlertCircle className='h-4 w-4' />
        <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
          <div className='pr-8'>
            <AlertTitle className='font-semibold'>Need testnet tokens?</AlertTitle>
            <AlertDescription>
              To use the app on testnet you need gas tokens and test USDC.
              {' '}
              Use these faucets:
            </AlertDescription>
            <div className='mt-2 flex flex-wrap gap-2'>
              <Button asChild size='sm' variant='secondary'>
                <a href='https://dev.kinetic.market/dashboard' target='_blank' rel='noopener noreferrer'>
                  Get test USDC (Kinetic)
                </a>
              </Button>
              <Button asChild size='sm' variant='secondary'>
                <a href='https://faucet.flare.network' target='_blank' rel='noopener noreferrer'>
                  Get gas tokens (Flare Faucet)
                </a>
              </Button>
            </div>
          </div>
          <button
            type='button'
            aria-label='Dismiss'
            onClick={handleDismiss}
            className='absolute right-2 top-2 rounded p-1 text-amber-900/70 hover:bg-amber-100'
          >
            <X className='h-4 w-4' />
          </button>
        </div>
      </Alert>
    </div>
  )
}

export default FaucetNotice