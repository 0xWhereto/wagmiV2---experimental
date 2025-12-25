import { ethers } from "hardhat";

// V3 Addresses
const CONTRACTS = {
  mim: "0x9ea06883EE9aA5F93d68fb3E85C4Cf44f4C01073",
  stakingVault: "0x0C55BC6A970055Bde2FFF573338cDC396DE5eF22",
  mimUsdcPool: "0x61B0f8EFc07C255681a09ed98d6b47Aa1a194D87",
  swethMimPool: "0x1b287D79E341C52B2aeC78a3803042D222C8Ab24",
  oracle: "0xA5725c6694DcDC1fba1BB26115c16DA633B41dbA",
  v3Vault: "0x40a8af8516cC5557127e6601cC5c794EDB5F97C8",
  leverageAMM: "0x1f0447A083fDD5099a310F1e1897F9Fb1043c875",
  wToken: "0x6dbB555EaD5D236e912fCFe28cec0C737E9E1D04",
};

const sUSDC = "0xa56a2C5678f8e10F61c6fBafCB0887571B9B432B";
const sWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== E2E Test: 0IL Protocol V3 ===\n");
  console.log("Tester:", signer.address);
  
  let passed = 0;
  let failed = 0;
  
  // ============ Test 1: MIM Minting with sUSDC ============
  console.log("\n=== Test 1: Mint MIM with sUSDC ===");
  const mim = new ethers.Contract(CONTRACTS.mim, [
    "function balanceOf(address) view returns (uint256)",
    "function mintWithUSDC(uint256) external",
    "function usdc() view returns (address)"
  ], signer);
  
  const susdcToken = new ethers.Contract(sUSDC, [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address,uint256)"
  ], signer);
  
  try {
    const susdcBal = await susdcToken.balanceOf(signer.address);
    console.log("   sUSDC balance:", ethers.utils.formatUnits(susdcBal, 6));
    
    if (susdcBal.gt(0)) {
      // Approve and mint with 1 sUSDC
      const mintAmount = ethers.utils.parseUnits("1", 6);
      await (await susdcToken.approve(CONTRACTS.mim, mintAmount)).wait();
      
      const mimBefore = await mim.balanceOf(signer.address);
      await (await mim.mintWithUSDC(mintAmount, { gasLimit: 1000000 })).wait();
      const mimAfter = await mim.balanceOf(signer.address);
      
      const mimReceived = mimAfter.sub(mimBefore);
      console.log("   MIM received:", ethers.utils.formatEther(mimReceived));
      console.log("   ✓ PASSED: mintWithUSDC works!");
      passed++;
    } else {
      console.log("   ⚠ SKIPPED: No sUSDC balance");
    }
  } catch (e: any) {
    console.log("   ✗ FAILED:", e.reason || e.message?.slice(0, 100));
    failed++;
  }
  
  // ============ Test 2: MIM Staking ============
  console.log("\n=== Test 2: Stake MIM to get sMIM ===");
  const stakingVault = new ethers.Contract(CONTRACTS.stakingVault, [
    "function deposit(uint256) external returns (uint256)",
    "function withdraw(uint256) external returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
    "function getCash() view returns (uint256)"
  ], signer);
  
  try {
    const mimBal = await mim.balanceOf(signer.address);
    console.log("   MIM balance:", ethers.utils.formatEther(mimBal));
    
    if (mimBal.gt(ethers.utils.parseEther("1"))) {
      const stakeAmount = ethers.utils.parseEther("1");
      await (await new ethers.Contract(CONTRACTS.mim, ["function approve(address,uint256)"], signer)
        .approve(CONTRACTS.stakingVault, stakeAmount)).wait();
      
      const smimBefore = await stakingVault.balanceOf(signer.address);
      await (await stakingVault.deposit(stakeAmount, { gasLimit: 500000 })).wait();
      const smimAfter = await stakingVault.balanceOf(signer.address);
      
      console.log("   sMIM received:", ethers.utils.formatEther(smimAfter.sub(smimBefore)));
      console.log("   ✓ PASSED: MIM staking works!");
      passed++;
    } else {
      console.log("   ⚠ SKIPPED: Not enough MIM");
    }
  } catch (e: any) {
    console.log("   ✗ FAILED:", e.reason || e.message?.slice(0, 100));
    failed++;
  }
  
  // ============ Test 3: MIM Unstaking ============
  console.log("\n=== Test 3: Unstake sMIM to get MIM ===");
  try {
    const smimBal = await stakingVault.balanceOf(signer.address);
    console.log("   sMIM balance:", ethers.utils.formatEther(smimBal));
    
    if (smimBal.gt(ethers.utils.parseEther("0.5"))) {
      const unstakeAmount = ethers.utils.parseEther("0.5");
      
      const mimBefore = await mim.balanceOf(signer.address);
      await (await stakingVault.withdraw(unstakeAmount, { gasLimit: 500000 })).wait();
      const mimAfter = await mim.balanceOf(signer.address);
      
      console.log("   MIM received:", ethers.utils.formatEther(mimAfter.sub(mimBefore)));
      console.log("   ✓ PASSED: MIM unstaking works!");
      passed++;
    } else {
      console.log("   ⚠ SKIPPED: Not enough sMIM");
    }
  } catch (e: any) {
    console.log("   ✗ FAILED:", e.reason || e.message?.slice(0, 100));
    failed++;
  }
  
  // ============ Test 4: 0IL Vault Deposit ============
  console.log("\n=== Test 4: Deposit sWETH to 0IL Vault ===");
  const wToken = new ethers.Contract(CONTRACTS.wToken, [
    "function deposit(uint256,uint256) external returns (uint256)",
    "function withdraw(uint256,uint256) external returns (uint256)",
    "function balanceOf(address) view returns (uint256)"
  ], signer);
  
  const swethToken = new ethers.Contract(sWETH, [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address,uint256)"
  ], signer);
  
  try {
    const swethBal = await swethToken.balanceOf(signer.address);
    console.log("   sWETH balance:", ethers.utils.formatEther(swethBal));
    
    if (swethBal.gt(ethers.utils.parseEther("0.00005"))) {
      const depositAmount = ethers.utils.parseEther("0.00005");
      await (await swethToken.approve(CONTRACTS.wToken, depositAmount)).wait();
      
      const wethBefore = await wToken.balanceOf(signer.address);
      await (await wToken.deposit(depositAmount, 0, { gasLimit: 3000000 })).wait();
      const wethAfter = await wToken.balanceOf(signer.address);
      
      console.log("   wETH received:", ethers.utils.formatEther(wethAfter.sub(wethBefore)));
      console.log("   ✓ PASSED: 0IL deposit works!");
      passed++;
    } else {
      console.log("   ⚠ SKIPPED: Not enough sWETH");
    }
  } catch (e: any) {
    console.log("   ✗ FAILED:", e.reason || e.message?.slice(0, 100));
    failed++;
  }
  
  // ============ Test 5: 0IL Vault Withdraw ============
  console.log("\n=== Test 5: Withdraw from 0IL Vault ===");
  try {
    const wethBal = await wToken.balanceOf(signer.address);
    console.log("   wETH balance:", ethers.utils.formatEther(wethBal));
    
    if (wethBal.gt(0)) {
      const swethBefore = await swethToken.balanceOf(signer.address);
      await (await wToken.withdraw(wethBal, 0, { gasLimit: 3000000 })).wait();
      const swethAfter = await swethToken.balanceOf(signer.address);
      
      console.log("   sWETH received:", ethers.utils.formatEther(swethAfter.sub(swethBefore)));
      console.log("   ✓ PASSED: 0IL withdrawal works!");
      passed++;
    } else {
      console.log("   ⚠ SKIPPED: No wETH balance");
    }
  } catch (e: any) {
    console.log("   ✗ FAILED:", e.reason || e.message?.slice(0, 100));
    failed++;
  }
  
  // ============ Test 6: Oracle Price ============
  console.log("\n=== Test 6: Oracle Price Check ===");
  const oracle = new ethers.Contract(CONTRACTS.oracle, [
    "function getPrice() view returns (uint256)"
  ], signer);
  
  try {
    const price = await oracle.getPrice();
    console.log("   Price:", ethers.utils.formatEther(price), "MIM per sWETH");
    
    const priceNum = parseFloat(ethers.utils.formatEther(price));
    if (priceNum > 2000 && priceNum < 5000) {
      console.log("   ✓ PASSED: Price is reasonable (~3000)");
      passed++;
    } else {
      console.log("   ✗ FAILED: Price seems wrong");
      failed++;
    }
  } catch (e: any) {
    console.log("   ✗ FAILED:", e.reason || e.message?.slice(0, 100));
    failed++;
  }
  
  // ============ Summary ============
  console.log("\n" + "=".repeat(50));
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  console.log("=".repeat(50));
  
  if (failed === 0) {
    console.log("\n✅ ALL TESTS PASSED!");
  } else {
    console.log("\n⚠ Some tests failed - review output above");
  }
}

main().catch(console.error);


