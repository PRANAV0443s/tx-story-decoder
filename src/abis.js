// A small local library of known ABI fragments used to decode calldata
// and revert reasons for common contract types, without needing a
// third-party indexer or Etherscan API lookups.
//
// Extend this as you encounter more contracts during the build.

export const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
];

export const UNISWAP_V2_ROUTER_ABI = [
  "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) returns (uint256[] amounts)",
  "function swapExactETHForTokens(uint256 amountOutMin, address[] path, address to, uint256 deadline) payable returns (uint256[] amounts)",
  "function swapExactTokensForETH(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) returns (uint256[] amounts)",
];

export const UNISWAP_V3_ROUTER_ABI = [
  "function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 deadline,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96)) payable returns (uint256 amountOut)",
  "function exactOutputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 deadline,uint256 amountOut,uint256 amountInMaximum,uint160 sqrtPriceLimitX96)) payable returns (uint256 amountIn)",
];

// Common custom Solidity errors used across many protocols. Decoding
// these turns a bare 4-byte selector into a readable failure reason.
export const COMMON_ERRORS_ABI = [
  "error InsufficientBalance(uint256 available, uint256 required)",
  "error Unauthorized()",
  "error Expired(uint256 deadline)",
  "error SlippageExceeded(uint256 amountOut, uint256 amountOutMin)",
  "error TooLittleReceived()",
  "error TooMuchRequested()",
  "error InsufficientAllowance()",
];

// Combine every fragment into one interface so we can attempt decoding
// against all known shapes without knowing in advance which contract
// we're looking at.
export const ALL_ABI_FRAGMENTS = [
  ...ERC20_ABI,
  ...UNISWAP_V2_ROUTER_ABI,
  ...UNISWAP_V3_ROUTER_ABI,
  ...COMMON_ERRORS_ABI,
];
