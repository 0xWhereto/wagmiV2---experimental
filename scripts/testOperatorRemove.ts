import { ethers } from "hardhat";

const V3_VAULT = "0xD9BaA26A6bA870663C411a410446f6B78b56C6a7";
const LEVERAGE_AMM = "0xf6b8AC2c2EfeA1966dd0696091e6c461a6a90cd1";
const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Test Operator removeLiquidity ===\n");
  
  // Deploy a simple test contract that calls removeLiquidity
  const testCode = `
    // SPDX-License-Identifier: MIT
    pragma solidity ^0.8.23;
    
    interface IV3LPVault {
      function removeLiquidity(uint256 liquidityPercent, uint256 amount0Min, uint256 amount1Min) external returns (uint256 amount0, uint256 amount1);
    }
    
    contract OperatorTest {
      IV3LPVault public vault;
      
      constructor(address _vault) {
        vault = IV3LPVault(_vault);
      }
      
      function testRemove() external returns (uint256, uint256) {
        return vault.removeLiquidity(10000, 0, 0);
      }
    }
  `;
  
  // We can't deploy arbitrary contracts easily, so let's just use the LeverageAMM as the operator
  // But the issue is LeverageAMM's closePosition has other logic. Let's check if LeverageAMM
  // can successfully call v3LPVault.removeLiquidity by looking at the transaction trace.
  
  // Actually, let's check if there's something in the way LeverageAMM was compiled
  // vs how V3LPVault expects to be called
  
  // Let's try calling removeLiquidity directly from the owner (deployer) who is also an operator
  const V3LPVault = await ethers.getContractFactory("V3LPVault");
  const v3Vault = V3LPVault.attach(V3_VAULT);
  
  const sweth = new ethers.Contract(SWETH, ["function balanceOf(address) view returns (uint256)"], signer);
  const mim = new ethers.Contract(MIM, ["function balanceOf(address) view returns (uint256)"], signer);
  
  console.log("Before removeLiquidity:");
  console.log("  V3Vault sWETH:", ethers.utils.formatEther(await sweth.balanceOf(V3_VAULT)));
  console.log("  V3Vault MIM:", ethers.utils.formatEther(await mim.balanceOf(V3_VAULT)));
  console.log("  Owner sWETH:", ethers.utils.formatEther(await sweth.balanceOf(signer.address)));
  console.log("  Owner MIM:", ethers.utils.formatEther(await mim.balanceOf(signer.address)));
  
  // Check if owner is operator
  console.log("\nIs owner an operator:", await v3Vault.isOperator(signer.address));
  
  // Add owner as operator if not already
  if (!(await v3Vault.isOperator(signer.address))) {
    console.log("Adding owner as operator...");
    await (await v3Vault.setOperator(signer.address, true)).wait();
  }
  
  // Call removeLiquidity as owner (who is also an operator)
  console.log("\nCalling removeLiquidity(10000, 0, 0) as owner+operator...");
  try {
    const tx = await v3Vault.removeLiquidity(10000, 0, 0, { gasLimit: 2000000 });
    const receipt = await tx.wait();
    console.log("SUCCESS! Gas used:", receipt.gasUsed.toString());
    
    console.log("\nAfter removeLiquidity:");
    console.log("  Owner sWETH:", ethers.utils.formatEther(await sweth.balanceOf(signer.address)));
    console.log("  Owner MIM:", ethers.utils.formatEther(await mim.balanceOf(signer.address)));
  } catch (err: any) {
    console.log("FAILED:", err.reason || err.message);
  }
}
main().catch(console.error);
