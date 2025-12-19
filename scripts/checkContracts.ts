import { ethers } from "hardhat";

async function main() {
  const LZ_ENDPOINT_SONIC = "0x6F475642a6e85809B1c36Fa62763669b1b48DD5B";
  const LZ_ENDPOINT_STANDARD = "0x1a44076050125825900e736c501f859c50fE728c";
  const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3";

  console.log("Checking contract code...\n");
  
  const lzSonicCode = await ethers.provider.getCode(LZ_ENDPOINT_SONIC);
  console.log(`LayerZero Endpoint SONIC (${LZ_ENDPOINT_SONIC}): ${lzSonicCode.length > 2 ? '✅ DEPLOYED' : '❌ NOT DEPLOYED'} (${lzSonicCode.length} bytes)`);
  
  const lzStandardCode = await ethers.provider.getCode(LZ_ENDPOINT_STANDARD);
  console.log(`LayerZero Endpoint Standard (${LZ_ENDPOINT_STANDARD}): ${lzStandardCode.length > 2 ? '✅ DEPLOYED' : '❌ NOT DEPLOYED'} (${lzStandardCode.length} bytes)`);
  
  const permit2Code = await ethers.provider.getCode(PERMIT2);
  console.log(`Permit2 (${PERMIT2}): ${permit2Code.length > 2 ? '✅ DEPLOYED' : '❌ NOT DEPLOYED'} (${permit2Code.length} bytes)`);
}

main().catch(console.error);

