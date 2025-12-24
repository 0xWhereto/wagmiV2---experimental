import { ethers } from "hardhat";

const NEW_GATEWAY = "0x2d603F7B0d06Bd5f6232Afe1991aF3D103d68071";
const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("=== Test Bridge from Arbitrum ===");
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.utils.formatEther(await deployer.getBalance()), "ETH");
  
  const gateway = await ethers.getContractAt("GatewayVault", NEW_GATEWAY);
  
  // Check USDC balance
  const usdc = await ethers.getContractAt("IERC20", USDC);
  const balance = await usdc.balanceOf(deployer.address);
  console.log("USDC balance:", ethers.utils.formatUnits(balance, 6));
  
  if (balance.eq(0)) {
    console.log("No USDC to bridge!");
    return;
  }
  
  // Amount to bridge - 1 USDC
  const amount = ethers.utils.parseUnits("1", 6);
  
  // LZ options
  const options = ethers.utils.solidityPack(
    ['uint16', 'uint8', 'uint16', 'uint8', 'uint128'],
    [3, 1, 17, 1, 500000]
  );
  
  // Assets to bridge - correct field name is tokenAmount
  const assets = [{
    tokenAddress: USDC,
    tokenAmount: amount
  }];
  
  console.log("\nGetting quote...");
  try {
    const quote = await gateway.quoteDeposit(deployer.address, assets, options);
    console.log("Quote nativeFee:", ethers.utils.formatEther(quote), "ETH");
    
    // Check allowance
    const allowance = await usdc.allowance(deployer.address, NEW_GATEWAY);
    console.log("Current allowance:", ethers.utils.formatUnits(allowance, 6));
    
    if (allowance.lt(amount)) {
      console.log("\nApproving USDC...");
      const tx = await usdc.approve(NEW_GATEWAY, ethers.constants.MaxUint256);
      await tx.wait();
      console.log("✓ Approved");
    }
    
    console.log("\nBridging 1 USDC...");
    const tx = await gateway.deposit(deployer.address, assets, options, { value: quote });
    console.log("TX:", tx.hash);
    const receipt = await tx.wait();
    console.log("✓ Bridge TX confirmed! Gas used:", receipt.gasUsed.toString());
    console.log("\nCheck LayerZero scan for message delivery.");
  } catch (e: any) {
    console.error("Error:", e.reason || e.message);
    if (e.error?.data) console.error("Data:", e.error.data);
  }
}

main().catch(console.error);
