import "dotenv/config";
import { ethers } from "ethers";
import { decodeCalldata, decodeRevertReason } from "./decoder.js";

const API_KEY = process.env.ALCHEMY_API_KEY;
if (!API_KEY) {
  console.error(
    "Missing ALCHEMY_API_KEY. Copy .env.example to .env and fill it in."
  );
  process.exit(1);
}

const WS_URL = `wss://eth-mainnet.g.alchemy.com/v2/${API_KEY}`;
const HTTP_URL = `https://eth-mainnet.g.alchemy.com/v2/${API_KEY}`;

// Two providers: one for the live WebSocket subscription (blocks),
// one plain HTTPS provider for the follow-up eth_call / receipt reads
// that happen per-transaction. Keeping them separate avoids piling
// request/response traffic onto the single WS connection.
const wsProvider = new ethers.WebSocketProvider(WS_URL);
const httpProvider = new ethers.JsonRpcProvider(HTTP_URL);

console.log("Connecting to Ethereum mainnet via Alchemy WebSocket...");
console.log("Listening for failed transactions in new blocks.\n");

wsProvider.on("block", async (blockNumber) => {
  try {
    await processBlock(blockNumber);
  } catch (err) {
    console.error(`Error processing block ${blockNumber}:`, err.message);
  }
});

async function processBlock(blockNumber) {
  const block = await httpProvider.getBlock(blockNumber, true /* prefetch txs */);
  if (!block || !block.transactions?.length) return;

  console.log(`--- Block ${blockNumber} (${block.transactions.length} txs) ---`);

  // Process sequentially to stay well within free-tier rate limits.
  // For higher throughput, batch these with p-limit or similar.
  for (const txHash of block.transactions) {
    await checkTransaction(txHash, blockNumber);
  }
}

async function checkTransaction(txHash, blockNumber) {
  const receipt = await httpProvider.getTransactionReceipt(txHash);
  if (!receipt) return;

  // status === 0 means the transaction reverted on-chain
  if (receipt.status !== 0) return;

  const tx = await httpProvider.getTransaction(txHash);
  if (!tx) return;

  const revertData = await getRevertData(tx, blockNumber);
  const story = buildStory(tx, receipt, revertData);
  console.log(story + "\n");
}

/**
 * Replay the transaction with eth_call at the block right before it
 * was mined, using identical params. A revert throws an error whose
 * `.data` field contains the ABI-encoded revert reason.
 */
async function getRevertData(tx, blockNumber) {
  try {
    await httpProvider.call(
      {
        from: tx.from,
        to: tx.to,
        data: tx.data,
        value: tx.value,
        gasLimit: tx.gasLimit,
      },
      blockNumber - 1
    );
    // If eth_call didn't throw, we can't recover a revert reason this way
    // (can happen with state that changed between blocks).
    return null;
  } catch (err) {
    // ethers surfaces revert data at err.data (v6) or err.error.data (some RPCs)
    return err.data ?? err.error?.data ?? null;
  }
}

function buildStory(tx, receipt, revertData) {
  const calldataStory = decodeCalldata(tx.data);
  const revertStory = revertData
    ? decodeRevertReason(revertData)
    : "reverted (reason unavailable — state may have changed since the block was mined)";

  return [
    `Tx:      ${tx.hash}`,
    `From:    ${tx.from}`,
    `To:      ${tx.to ?? "(contract creation)"}`,
    `Gas used: ${receipt.gasUsed?.toString() ?? "unknown"}`,
    `Attempted: ${calldataStory}`,
    `Failure:   ${revertStory}`,
  ].join("\n");
}

wsProvider.websocket.on("error", (err) => {
  console.error("WebSocket error:", err.message);
});

process.on("SIGINT", async () => {
  console.log("\nShutting down...");
  await wsProvider.destroy();
  process.exit(0);
});
