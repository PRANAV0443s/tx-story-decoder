import "dotenv/config";
import express from "express";
import { ethers } from "ethers";

const RPC_URL = "https://api.calibration.node.glif.io/rpc/v1";
const CONTRACT_ADDRESS = "0x09a0fDc2723fAd1A7b8e3e00eE5DF73841df55a0";

const provider = new ethers.JsonRpcProvider(RPC_URL);
const app = express();
const PORT = 3000;

async function fetchRecentLogs() {
  const latestBlock = await provider.getBlockNumber();
  const fromBlock = Math.max(0, latestBlock - 2000);

  const logs = await provider.getLogs({
    address: CONTRACT_ADDRESS,
    fromBlock,
    toBlock: latestBlock,
  });

  return logs.map((log) => ({
    blockNumber: log.blockNumber,
    transactionHash: log.transactionHash,
    topics: log.topics,
    data: log.data,
  }));
}

app.get("/logs", async (_req, res) => {
  try {
    const logs = await fetchRecentLogs();
    res.json({ count: logs.length, contract: CONTRACT_ADDRESS, logs });
  } catch (err) {
    console.error("Error fetching logs:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Filecoin Pay log explorer running at http://localhost:${PORT}/logs`);
});