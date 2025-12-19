import { ethers } from "hardhat";

const TX_HASH = "0x60fd06596278c2939375b373bed1f8b1f674a62226254bd8ae231932b76cc991";

// Hub ABI for withdrawTo
const HUB_ABI = [
  "function withdrawTo(uint32 _dstEid, address _recipient, tuple(address tokenAddress, uint256 tokenAmount)[] _assets, bytes _options) external payable returns (tuple(bytes32 guid, uint64 nonce, tuple(uint256 nativeFee, uint256 lzTokenFee) fee))",
];

async function main() {
  const provider = new ethers.providers.JsonRpcProvider("https://rpc.soniclabs.com");
  
  const tx = await provider.getTransaction(TX_HASH);
  if (!tx) {
    console.log("Transaction not found");
    return;
  }

  console.log("Transaction Data:", tx.data);
  console.log("\nFunction selector:", tx.data.slice(0, 10));

  // Calculate expected selector for withdrawTo
  const iface = new ethers.utils.Interface(HUB_ABI);
  const withdrawToSelector = iface.getSighash("withdrawTo");
  console.log("Expected withdrawTo selector:", withdrawToSelector);

  // Try to decode
  if (tx.data.slice(0, 10) === withdrawToSelector) {
    try {
      const decoded = iface.decodeFunctionData("withdrawTo", tx.data);
      console.log("\nDecoded withdrawTo:");
      console.log("  dstEid:", decoded._dstEid);
      console.log("  recipient:", decoded._recipient);
      console.log("  assets:", decoded._assets);
      console.log("  options:", decoded._options);
    } catch (e: any) {
      console.log("Failed to decode:", e.message);
    }
  }

  // Let's also try to simulate the call
  console.log("\n--- Simulating Call ---");
  try {
    const result = await provider.call({
      to: tx.to,
      from: tx.from,
      data: tx.data,
      value: tx.value,
    });
    console.log("Simulation result:", result);
  } catch (e: any) {
    console.log("Simulation failed:");
    if (e.error?.data) {
      console.log("Error data:", e.error.data);
      // Try to decode common error signatures
      const errorData = e.error.data;
      if (errorData.startsWith("0x08c379a0")) {
        // Error(string)
        const reason = ethers.utils.defaultAbiCoder.decode(["string"], "0x" + errorData.slice(10));
        console.log("Revert reason:", reason[0]);
      }
    } else {
      console.log("Error:", e.reason || e.message);
    }
  }

  // Check user's synthetic token balance
  console.log("\n--- Checking User Synthetic Token Balances ---");
  const userAddress = tx.from;
  
  const syntheticTokens = [
    { symbol: "sWETH", address: "0x5E501C482952c1F2D58a4294F9A97759968c5125" },
    { symbol: "sUSDC", address: "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B" },
    { symbol: "sUSDT", address: "0x72dFC771E515423E5B0CD2acf703d0F7eb30bdEa" },
    { symbol: "sBTC", address: "0x1DeFDa524B2B5edB94299775B23d7E3dde1Fbb6C" },
  ];

  const erc20Abi = ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"];

  for (const token of syntheticTokens) {
    try {
      const contract = new ethers.Contract(token.address, erc20Abi, provider);
      const balance = await contract.balanceOf(userAddress);
      const decimals = await contract.decimals();
      const formatted = ethers.utils.formatUnits(balance, decimals);
      if (parseFloat(formatted) > 0) {
        console.log(`  ${token.symbol}: ${formatted}`);
      }
    } catch (e) {
      // Token might not exist
    }
  }
}

main().catch(console.error);
