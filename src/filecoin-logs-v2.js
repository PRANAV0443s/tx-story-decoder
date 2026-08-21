import "dotenv/config";
import express from "express";
import { ethers } from "ethers";

const RPC_URL = "https://api.calibration.node.glif.io/rpc/v1";
const CONTRACT_ADDRESS = "0x09a0fDc2723fAd1A7b8e3e00eE5DF73841df55a0";

const provider = new ethers.JsonRpcProvider(RPC_URL);
const app = express();
const PORT = 3000;

const KNOWN_EVENTS_ABI = [
  "event AccountLockupSettled(address indexed token, address indexed owner, uint256 lockupCurrent, uint256 lockupRate, uint256 lockupLastSettledAt)",
  "event OperatorApprovalUpdated(address indexed token, address indexed payer, address indexed operator, bool approved, uint256 rateAllowance, uint256 lockupAllowance, uint256 maxLockupPeriod)",
  "event RailLockupModified(uint256 indexed railId, uint256 oldLockupPeriod, uint256 newLockupPeriod, uint256 oldLockupFixed, uint256 newLockupFixed)",
  "event RailRateModified(uint256 indexed railId, uint256 oldRate, uint256 newRate )",
    "event RailSettled(uint256 indexed railId, uint256 totalSettledAmount, uint256 totalNetPayeeAmount, uint256 operatorCommission, uint256 settledUpTo, uint256 timestamp)",
];

const iface = new ethers.Interface(KNOWN_EVENTS_ABI);

async function fetchRecentLogs() {
  const latestBlock = await provider.getBlockNumber();
  const fromBlock = Math.max(0, latestBlock - 2000);
  return provider.getLogs({ address: CONTRACT_ADDRESS, fromBlock, toBlock: latestBlock });
}

function logToStory(log) {
  try {
    const parsed = iface.parseLog(log);
    if (!parsed) throw new Error("no match");

    switch (parsed.name) {
      case "AccountLockupSettled": {
        const { token, owner, lockupCurrent, lockupRate, lockupLastSettledAt } = parsed.args;
        return {
          event: "AccountLockupSettled",
          story: `Account ${short(owner)} had its lockup settled on token ${short(token)}: ` +
            `${lockupCurrent.toString()} currently locked, burning at ${lockupRate.toString()}/epoch, ` +
            `last settled at epoch ${lockupLastSettledAt.toString()}.`,
        };
      }
      case "OperatorApprovalUpdated": {
        const { token, payer, operator, approved, rateAllowance, lockupAllowance, maxLockupPeriod } = parsed.args;
        return {
          event: "OperatorApprovalUpdated",
          story: `Payer ${short(payer)} ${approved ? "approved" : "revoked"} operator ${short(operator)} ` +
            `on token ${short(token)} — rate allowance ${rateAllowance.toString()}, ` +
            `lockup allowance ${lockupAllowance.toString()}, max lockup period ${maxLockupPeriod.toString()} epochs.`,
        };
      }
      case "RailLockupModified": {
        const { railId, oldLockupPeriod, newLockupPeriod, oldLockupFixed, newLockupFixed } = parsed.args;
        return {
          event: "RailLockupModified",
          story: `Rail #${railId.toString()}: lockup period changed ${oldLockupPeriod.toString()} -> ${newLockupPeriod.toString()} epochs, ` +
            `fixed lockup changed ${oldLockupFixed.toString()} -> ${newLockupFixed.toString()}.`,
        };
      }
      case "RailRateModified": {
        const { railId, oldRate, newRate } = parsed.args;
        const direction = newRate > oldRate ? "increased" : newRate < oldRate ? "decreased" : "unchanged";
        return {
          event: "RailRateModified",
          story: `Rail #${railId.toString()}: payment rate ${direction} from ${oldRate.toString()} to ${newRate.toString()} per epoch.`,
        };
      }
      default:
        return { event: parsed.name, story: `Unhandled known event: ${parsed.name}` };
              case "RailSettled": {
        const { railId, totalSettledAmount, totalNetPayeeAmount, operatorCommission, settledUpTo } = parsed.args;
        return {
          event: "RailSettled",
          story: `Rail #${railId.toString()} settled: ${totalSettledAmount.toString()} total paid out ` +
            `(${totalNetPayeeAmount.toString()} to payee, ${operatorCommission.toString()} operator commission), ` +
            `settled up to epoch ${settledUpTo.toString()}.`,
        };
      }
    }
  } catch {
    return {
      event: "unknown",
      story: `Unrecognized event (topic ${log.topics[0]}) — not yet in local ABI.`,
    };
  }
}

function short(addr) {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

app.get("/logs", async (_req, res) => {
  try {
    const logs = await fetchRecentLogs();
    res.json({
      count: logs.length,
      contract: CONTRACT_ADDRESS,
      logs: logs.map((log) => ({
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
        topics: log.topics,
        data: log.data,
      })),
    });
  } catch (err) {
    console.error("Error fetching logs:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/stories", async (_req, res) => {
  try {
    const logs = await fetchRecentLogs();
    const stories = logs.map((log) => ({
      blockNumber: log.blockNumber,
      transactionHash: log.transactionHash,
      ...logToStory(log),
    }));
    const knownCount = stories.filter((s) => s.event !== "unknown").length;
    res.json({
      count: stories.length,
      decoded: knownCount,
      unrecognized: stories.length - knownCount,
      contract: CONTRACT_ADDRESS,
      stories,
    });
  } catch (err) {
    console.error("Error building stories:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Filecoin Pay story decoder running:`);
  console.log(`  Raw logs:    http://localhost:${PORT}/logs`);
  console.log(`  Stories:     http://localhost:${PORT}/stories`);
});
