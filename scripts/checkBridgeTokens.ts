import { ethers } from "hardhat";

async function main() {
  const hubAbi = [
    "function bridgeTokens(address _recipient, tuple(address tokenAddress, uint256 tokenAmount)[] _assets, uint32 _dstEid, bytes _options) external payable returns (tuple(bytes32 guid, uint64 nonce, tuple(uint256 nativeFee, uint256 lzTokenFee) fee))",
  ];

  const iface = new ethers.utils.Interface(hubAbi);
  const selector = iface.getSighash("bridgeTokens");
  console.log("bridgeTokens selector:", selector);

  // Now let's decode the actual transaction
  const TX_HASH = "0x60fd06596278c2939375b373bed1f8b1f674a62226254bd8ae231932b76cc991";
  const provider = new ethers.providers.JsonRpcProvider("https://rpc.soniclabs.com");
  const tx = await provider.getTransaction(TX_HASH);
  
  console.log("\nActual tx selector:", tx?.data.slice(0, 10));

  if (tx?.data.slice(0, 10) === selector) {
    const decoded = iface.decodeFunctionData("bridgeTokens", tx.data);
    console.log("\nDecoded bridgeTokens:");
    console.log("  recipient:", decoded._recipient);
    console.log("  assets:", decoded._assets);
    console.log("  dstEid:", decoded._dstEid);
    console.log("  options:", decoded._options);
  }
}

main().catch(console.error);
