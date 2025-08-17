import React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card';
import {
  CONTRACTS,
  pumpkinSpiceLatteAddress,
} from '../contracts/PumpkinSpiceLatte';
import { formatUnits, parseAbiItem } from 'viem';
import { Award, History, AlertCircle, ExternalLink } from 'lucide-react';
import { getAddressExplorerUrl, getTxExplorerUrl } from '../lib/utils';

interface WinnerItem {
  blockNumber: bigint;
  winner: string;
  amount: bigint;
  txHash?: `0x${string}`;
}

const Winners = () => {
  const { address, chain, isConnected } = useAccount();
  const isSupportedNetwork = chain && (CONTRACTS as any)[String(chain.id)];
  const targetChainId = isSupportedNetwork ? chain!.id : 747474;
  const publicClient = usePublicClient({ chainId: targetChainId });

  const contractAddress =
    CONTRACTS[targetChainId as keyof typeof CONTRACTS]?.pumpkinSpiceLatte ??
    pumpkinSpiceLatteAddress;

  // Deployment block hints for faster historical scans where known
  const fromBlockHint = useMemo(() => {
    if (targetChainId === 1) {
      // Mainnet deployment block (from broadcast)
      return 0x161534en;
    }
    // Unknown on non-mainnet chains; fall back to scanning a recent window
    return null as bigint | null;
  }, [targetChainId]);


  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [winners, setWinners] = useState<WinnerItem[]>([]);

// <<<<<<< HEAD
//   useEffect(() => {
//     let cancelled = false;
//     const fetchLogs = async () => {
//       if (!publicClient || !isConnected) return;
// =======
	// Very short history by default; if we have a deployment hint, scan from there once
	useEffect(() => {
		let cancelled = false;
		if (!publicClient) return;

		const event = parseAbiItem('event PrizeAwarded(address indexed winner, uint256 amount)');
		const SHORT_WINDOW = 10n; // default: last 10 blocks
		const CHUNK = 10n; // request chunk
		const MICRO = 5n;  // fallback chunk

		const appendItems = (newItems: WinnerItem[]) => {
			if (cancelled || newItems.length === 0) return;
			setWinners(prev => {
				const map = new Map<string, WinnerItem>();
				for (const it of prev) map.set(`${it.txHash ?? ''}:${it.blockNumber.toString()}:${it.winner}`, it);
				for (const it of newItems) map.set(`${it.txHash ?? ''}:${it.blockNumber.toString()}:${it.winner}`, it);
				const merged = Array.from(map.values());
				merged.sort((a, b) => (a.blockNumber > b.blockNumber ? -1 : 1));
				return merged;
			});
		};

		const fetchRange = async (fromB: bigint, toB: bigint) => {
			if (fromB > toB) return;
			let cursor = fromB;
			while (!cancelled && cursor <= toB) {
				const to = (cursor + CHUNK - 1n) > toB ? toB : (cursor + CHUNK - 1n);
				try {
					const logs = await publicClient.getLogs({ address: contractAddress as `0x${string}`, event, fromBlock: cursor, toBlock: to });
					appendItems(logs.map(log => ({
						blockNumber: log.blockNumber ?? 0n,
						winner: (log.args as any).winner as string,
						amount: (log.args as any).amount as bigint,
						txHash: log.transactionHash,
					})));
				} catch (err) {
					// Retry with micro chunks
					let inner = cursor;
					while (!cancelled && inner <= to) {
						const innerTo = (inner + MICRO - 1n) > to ? to : (inner + MICRO - 1n);
						const logs = await publicClient.getLogs({ address: contractAddress as `0x${string}`, event, fromBlock: inner, toBlock: innerTo });
						appendItems(logs.map(log => ({
							blockNumber: log.blockNumber ?? 0n,
							winner: (log.args as any).winner as string,
							amount: (log.args as any).amount as bigint,
							txHash: log.transactionHash,
						})));
						inner = innerTo + 1n;
					}
				}
				cursor = to + 1n;
			}
		};

		let stop = false;
		(async () => {
			try {
				setLoading(true);
				setError(null);
				const latest = await publicClient.getBlockNumber();
				const start = fromBlockHint !== null ? fromBlockHint : (latest > SHORT_WINDOW ? (latest - SHORT_WINDOW) : 0n);
				await fetchRange(start, latest);
				if (cancelled) return;
				let lastTo = latest;
				const id = setInterval(async () => {
					if (stop) return;
					try {
						const now = await publicClient.getBlockNumber();
						if (now > lastTo) {
							await fetchRange(lastTo + 1n, now);
							lastTo = now;
						}
					} catch (e: any) {
						setError(e?.message || 'Failed to refresh winners');
					}
				}, 60_000);
				return () => clearInterval(id);
			} catch (e: any) {
				setError(e?.message || 'Failed to load winners');
			} finally {
				setLoading(false);
			}
		})();

		return () => { cancelled = true; stop = true };
	}, [publicClient, contractAddress, fromBlockHint, targetChainId]);
// >>>>>>> main

  //     // Check if contract address is valid (not zero address)
  //     if (contractAddress === '0x0000000000000000000000000000000000000000') {
  //       setError('Contract not deployed on this network yet');
  //       setLoading(false);
  //       return;
  //     }

  //     setLoading(true);
  //     setError(null);
  //     try {
  //       const event = parseAbiItem(
  //         'event PrizeAwarded(address indexed winner, uint256 amount)'
  //       );
  //       const logs = await publicClient.getLogs({
  //         address: contractAddress as `0x${string}`,
  //         event,
  //         fromBlock: 0n, // Start from block 0 for testnet
  //         toBlock: 'latest',
  //       });
  //       const items: WinnerItem[] = logs.map((log) => ({
  //         blockNumber: log.blockNumber ?? 0n,
  //         winner: (log.args as { winner: string }).winner,
  //         amount: (log.args as { amount: bigint }).amount,
  //         txHash: log.transactionHash,
  //       }));
  //       if (!cancelled) {
  //         items.sort((a, b) => (a.blockNumber > b.blockNumber ? -1 : 1));
  //         setWinners(items);
  //       }
  //     } catch (e: unknown) {
  //       if (!cancelled) {
  //         console.error('Error fetching winners:', e);
  //         setError('No lottery history available yet');
  //       }
  //     } finally {
  //       if (!cancelled) setLoading(false);
  //     }
  //   };

  //   fetchLogs();

  //   return () => {
  //     cancelled = true;
  //   };
  // }, [publicClient, contractAddress, isConnected]);

  const yourTotalWinnings = useMemo(() => {
    if (!address) return 0n;
    return winners.reduce(
      (acc, w) =>
        w.winner.toLowerCase() === address.toLowerCase() ? acc + w.amount : acc,
      0n
    );
  }, [winners, address]);

  const chainId = targetChainId;

  return (
    <Card className='border-0 shadow-none bg-transparent'>
      <CardHeader className='pb-3'>
        <CardTitle className='flex items-center gap-2 text-xl'>
          <span className='text-2xl'>📜</span> Lottery History
        </CardTitle>
        <CardDescription className='text-sm'>
          Recent winners and your lifetime winnings.
        </CardDescription>
        {!isSupportedNetwork && isConnected && (
          <div className='flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-2 rounded'>
            <AlertCircle className='h-4 w-4' /> Please switch to Coston2 network
          </div>
        )}
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='bg-[#f5f2f0] rounded-lg p-4'>
          <div className='flex justify-between items-center'>
            <p className='text-sm text-muted-foreground'>
              Your lifetime winnings
            </p>
            <p className='font-bold text-lg'>
              {formatUnits(yourTotalWinnings, 6)} USDC
            </p>
          </div>
        </div>
        <div>
          <p className='text-sm text-muted-foreground mb-3 flex items-center gap-2'>
            <span className='text-lg'>🏆</span> Historical winners
          </p>
          <div className='border rounded-lg bg-white'>
            {loading ? (
              <div className='p-4 text-sm'>Loading...</div>
            ) : error ? (
              <div className='p-4 text-sm text-amber-600 bg-amber-50 rounded'>
                <div className='flex items-center gap-2'>
                  <AlertCircle className='h-4 w-4' />
                  {error}
                </div>
              </div>
            ) : winners.length === 0 ? (
              <div className='p-4 text-sm text-muted-foreground'>
                No winners yet. Be the first to win! 🎉
              </div>
            ) : (
              <div className='max-h-48 overflow-y-auto'>
                <ul className='divide-y'>
                  {winners.map((w, idx) => (
                    <li
                      key={`${w.txHash}-${idx}`}
                      className='p-3 flex items-center justify-between gap-3'
                    >
                      <div className='min-w-0'>
                        <a
                          href={getAddressExplorerUrl(chainId, w.winner)}
                          target='_blank'
                          rel='noreferrer'
                          className='font-medium text-sm truncate text-blue-600 hover:underline'
                        >
                          {w.winner.slice(0, 6)}...{w.winner.slice(-4)}
                        </a>
                        <p className='text-xs text-muted-foreground flex items-center gap-1'>
                          Block #{w.blockNumber.toString()}
                          {w.txHash && (
                            <>
                              <span className='mx-1'>·</span>
                              <a
                                href={getTxExplorerUrl(chainId, w.txHash!)}
                                target='_blank'
                                rel='noreferrer'
                                className='inline-flex items-center gap-1 hover:underline'
                              >
                                <span>tx</span>
                                <ExternalLink className='h-3 w-3' />
                              </a>
                            </>
                          )}
                        </p>
                      </div>
                      <div className='shrink-0 font-semibold text-sm'>
                        {formatUnits(w.amount, 6)} USDC
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default Winners;
