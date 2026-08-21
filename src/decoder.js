import { ethers } from "ethers";
import { ALL_ABI_FRAGMENTS } from "./abis.js";

const iface = new ethers.Interface(ALL_ABI_FRAGMENTS);

/**
 * Try to decode a tx's calldata into a readable "function(args)" string.
 * Falls back to just the 4-byte selector if we don't recognize the ABI.
 */
export function decodeCalldata(data) {
  if (!data || data === "0x") return "plain ETH transfer (no calldata)";

  try {
    const parsed = iface.parseTransaction({ data });
    if (parsed) {
      const args = parsed.args.map((a) => stringifyArg(a)).join(", ");
      return `${parsed.name}(${args})`;
    }
  } catch {
    // fall through to selector-only reporting
  }

  const selector = data.slice(0, 10);
  return `unknown function (selector ${selector}) — ABI not in local library`;
}

/**
 * Try to decode revert data (from eth_call replay or a thrown error's
 * data field) into a readable reason: a require() string, a custom
 * error, or a raw fallback.
 */
export function decodeRevertReason(revertData) {
  if (!revertData || revertData === "0x") {
    return "reverted with no reason data (likely an assert/panic, or out of gas)";
  }

  // Standard require(string) reverts are ABI-encoded as Error(string)
  try {
    const reason = ethers.AbiCoder.defaultAbiCoder().decode(
      ["string"],
      "0x" + revertData.slice(10)
    );
    if (revertData.startsWith("0x08c379a0")) {
      return `require failed: "${reason[0]}"`;
    }
  } catch {
    // not a standard Error(string), try custom errors below
  }

  // Solidity Panic(uint256) selector: 0x4e487b71
  if (revertData.startsWith("0x4e487b71")) {
    try {
      const [code] = ethers.AbiCoder.defaultAbiCoder().decode(
        ["uint256"],
        "0x" + revertData.slice(10)
      );
      return `panic (code ${code}) — e.g. overflow, division by zero, or out-of-bounds array access`;
    } catch {
      return "panic (could not decode code)";
    }
  }

  // Try known custom errors from our local ABI library
  try {
    const parsed = iface.parseError(revertData);
    if (parsed) {
      const args = parsed.args.map((a) => stringifyArg(a)).join(", ");
      return `custom error ${parsed.name}(${args})`;
    }
  } catch {
    // unknown to us
  }

  const selector = revertData.slice(0, 10);
  return `reverted with unrecognized custom error (selector ${selector}) — contract ABI not in local library`;
}

function stringifyArg(arg) {
  if (typeof arg === "bigint") return arg.toString();
  if (Array.isArray(arg)) return `[${arg.map(stringifyArg).join(", ")}]`;
  return String(arg);
}
