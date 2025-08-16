#!/usr/bin/env bash
set -euo pipefail

ENDPOINT="https://virtual.mainnet.us-east.rpc.tenderly.co/420b1805-6a91-4b32-b1c2-d37896a360cb"

payload='{
    "jsonrpc": "2.0",
    "method": "tenderly_setBalance",
    "params": [["0xE58b9ee93700A616b50509C8292977FA7a0f8ce1"], "0xDE0B6B3A7640000"]
}'

while true; do
	echo "[live-testnet] $(date -Is) calling tenderly_setBalance..."
	curl -sS -X POST -H "Content-Type: application/json" -d "$payload" "$ENDPOINT" | cat
	sleep 5
done