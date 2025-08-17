import React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { CONTRACTS, pumpkinSpiceLatteAddress } from '../contracts/PumpkinSpiceLatte';
import { ScrollArea } from './ui/scroll-area';
import { formatUnits, parseAbiItem } from 'viem';
import { Award, History, AlertCircle, ExternalLink } from 'lucide-react';
import { getAddressExplorerUrl, getTxExplorerUrl } from '../lib/utils';

interface WinnerItem {
	blockNumber: bigint;
	winner: string;
	amount: bigint;
	txHash?: `0x${string}`;
}

const DEPLOYMENT_BLOCK_MAINNET = 0x161534en; // from broadcast (mainnet)

const Winners = () => {
	const { address, chain, isConnected } = useAccount();
	const isSupportedNetwork = chain && CONTRACTS[chain.id as keyof typeof CONTRACTS];
	const targetChainId = isSupportedNetwork ? chain!.id : 1;
	const publicClient = usePublicClient({ chainId: targetChainId });

	const contractAddress = CONTRACTS[targetChainId as keyof typeof CONTRACTS]?.pumpkinSpiceLatte ?? pumpkinSpiceLatteAddress;
	const fromBlockHint = useMemo(() => {
		if (targetChainId === 1) return DEPLOYMENT_BLOCK_MAINNET;
		return null as bigint | null; // unknown for non-mainnet; we will window-scan
	}, [targetChainId]);

	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [winners, setWinners] = useState<WinnerItem[]>([]);

	// Very short history: only the last 10 blocks (plus incremental updates)
	useEffect(() => {
		let cancelled = false;
		if (!publicClient) return;

		const event = parseAbiItem('event PrizeAwarded(address indexed winner, uint256 amount)');
		const SHORT_WINDOW = 10n; // last 10 blocks
		const CHUNK = 10n; // single request for that short window
		const MICRO = 5n;  // fallback

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

	const yourTotalWinnings = useMemo(() => {
		if (!address) return 0n;
		return winners.reduce((acc, w) => (w.winner.toLowerCase() === address.toLowerCase() ? acc + w.amount : acc), 0n);
	}, [winners, address]);

	const chainId = targetChainId;

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<History className="h-5 w-5 text-orange-600" /> Lottery History
				</CardTitle>
				<CardDescription>Recent winners and your lifetime winnings.</CardDescription>
				{!isSupportedNetwork && isConnected && (
					<div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-2 rounded">
						<AlertCircle className="h-4 w-4" /> Please switch to a supported network
					</div>
				)}
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="flex justify-between items-center">
					<p className="text-muted-foreground">Your lifetime winnings</p>
					<p className="font-bold text-lg">{formatUnits(yourTotalWinnings, 6)} USDC</p>
				</div>
				<div>
					<p className="text-sm text-muted-foreground mb-2 flex items-center gap-2"><Award className="h-4 w-4 text-yellow-600" /> Historical winners</p>
					<div className="border rounded">
						{loading ? (
							<div className="p-4 text-sm">Loading...</div>
						) : error ? (
							<div className="p-4 text-sm text-red-600">{error}</div>
						) : winners.length === 0 ? (
							<div className="p-4 text-sm">No winners yet</div>
						) : (
							<ScrollArea className="max-h-64">
								<ul className="divide-y">
									{winners.map((w, idx) => (
										<li key={`${w.txHash}-${idx}`} className="p-3 flex items-center justify-between gap-3">
											<div className="min-w-0">
												<a
													href={getAddressExplorerUrl(chainId, w.winner)}
													target="_blank"
													rel="noreferrer"
													className="font-medium text-sm truncate text-blue-600 hover:underline"
												>
													{w.winner.slice(0, 6)}...{w.winner.slice(-4)}
												</a>
												<p className="text-xs text-muted-foreground flex items-center gap-1">
													Block #{w.blockNumber.toString()}
													{w.txHash && (
														<>
															<span className="mx-1">·</span>
															<a
																href={getTxExplorerUrl(chainId, w.txHash!)}
																target="_blank"
																rel="noreferrer"
																className="inline-flex items-center gap-1 hover:underline"
															>
															<span>tx</span>
															<ExternalLink className="h-3 w-3" />
															</a>
														</>
													)}
												</p>
											</div>
											<div className="shrink-0 font-semibold">{formatUnits(w.amount, 6)} USDC</div>
										</li>
									))}
								</ul>
							</ScrollArea>
						)}
					</div>
				</div>
			</CardContent>
		</Card>
	);
};

export default Winners;
