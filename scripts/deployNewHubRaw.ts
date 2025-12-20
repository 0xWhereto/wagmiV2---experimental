import { ethers } from "hardhat";

const LZ_ENDPOINT_SONIC = "0x6F475642a6e85809B1c36Fa62763669b1b48DD5B";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

async function main() {
  console.log("=== DEPLOYING NEW HUB (RAW) ===\n");
  
  const [signer] = await ethers.getSigners();
  console.log(`Deployer: ${signer.address}`);
  
  // Get contract factory
  const Hub = await ethers.getContractFactory("SyntheticTokenHub");
  
  // Get deployment transaction
  const deployTx = Hub.getDeployTransaction(
    LZ_ENDPOINT_SONIC,
    signer.address,
    ZERO_ADDRESS,
    ZERO_ADDRESS,
    ZERO_ADDRESS
  );
  
  console.log(`Bytecode size: ${(deployTx.data as string).length / 2} bytes`);
  console.log(`Bytecode size: ${(deployTx.data as string).length / 2 / 1024} KB`);
  
  // Check if bytecode would create contract over 24KB
  // The bytecode includes constructor args, so deployed code is smaller
  // Contract creation bytecode = init code, which can be larger
  
  // Try to send with explicit gas
  console.log("\nSending deployment tx...");
  const tx = await signer.sendTransaction({
    data: deployTx.data,
    gasLimit: 30000000, // 30M gas
  });
  console.log(`TX: ${tx.hash}`);
  
  const receipt = await tx.wait();
  console.log(`Contract deployed at: ${receipt.contractAddress}`);
}

main().catch(console.error);
