# tx-story-decoder

Live mini block-explorer, built for Road to Devcon — Week 1 ("Reading Ethereum").

Watches new Ethereum mainnet blocks over an Alchemy **WebSocket** subscription
(no third-party indexer), finds **failed transactions**, and turns their
calldata + revert reason into a human-readable "story" — e.g.:

```
Tx:      0xabc123...
From:    0xdef456...
To:      0x7a250d5630b4cf539739df2c5dacb4c659f2488d (Uniswap V2 Router)
Gas used: 51234
Attempted: swapExactTokensForTokens(1000000000000000000, 950000000000000000, [0x..., 0x...], 0xdef..., 1234567890)
Failure:   require failed: "UniswapV2: INSUFFICIENT_OUTPUT_AMOUNT"
```

## Setup

```bash
npm install
cp .env.example .env
# edit .env and add your Alchemy API key (Ethereum Mainnet app)
npm start
```

## How it works

1. **Subscribe** to new blocks over WebSocket (`wsProvider.on("block", ...)`).
2. For each new block, **fetch its transactions and their receipts**
   (`eth_getTransactionReceipt`) via direct JSON-RPC calls.
3. Filter for `status === 0` — the on-chain marker for a reverted tx.
4. **Replay the failing call** with `eth_call` at the previous block to
   recover the revert data (Ethereum doesn't store revert reasons on-chain
   by default — you have to re-execute the call to get it).
5. **Decode**:
   - Calldata → function name + args, via a small local ABI library
     (`src/abis.js`) covering ERC-20, Uniswap V2/V3 routers, and common
     custom errors.
   - Revert data → either a `require(string)` reason, a Solidity `Panic`
     code, a recognized custom error, or a labeled "unknown" fallback.
6. Print the assembled story to the console.

## Known limitations / next steps

- **ABI coverage is intentionally small.** Unrecognized contracts fall
  back to "unknown function (selector 0x...)" — extend `src/abis.js` with
  more fragments (or fetch verified ABIs from Etherscan) to widen coverage.
- **Sequential processing.** Transactions in a block are checked one at a
  time to stay under free-tier rate limits. For busy blocks, consider
  batching with a concurrency limiter.
- **`eth_call` replay can occasionally succeed** even for a tx that
  failed on-chain, if the relevant state changed between blocks (e.g. a
  front-run). In that case the story reports "reason unavailable."
- No wallet, signing, or testnet setup required — entirely read-only,
  per the challenge prerequisites.

## Security

Your Alchemy API key is loaded from `.env`, which is git-ignored.
Never commit `.env` — only `.env.example` (no real key) is tracked.
