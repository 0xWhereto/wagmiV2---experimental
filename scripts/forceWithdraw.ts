import { ethers } from "hardhat";

const LEVERAGE_AMM = "0xBAF3F6A7ce4AfE9FE172Cf84b7Be99C45473bF74";
const WTOKEN = "0x1da18a479752820DD018feA75A27724fbA2F62e3";
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";
const STAKING_VAULT = "0x4671B3F169Daee1eC027d60B484ce4fb98cF7db7";
const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Force Withdraw with Extra MIM ===\n");
  
  const mim = new ethers.Contract(MIM, [
    "function balanceOf(address) view returns (uint256)",
    "function transfer(address,uint256)"
  ], signer);
  const sweth = new ethers.Contract(SWETH, ["function balanceOf(address) view returns (uint256)"], signer);
  
  const wToken = (await ethers.getContractFactory("WToken")).attach(WTOKEN);
  
  const wTokenBal = await wToken.balanceOf(signer.address);
  console.log("My wToken:", ethers.utils.formatEther(wTokenBal));
  
  // Inject 0.5 more MIM to cover the shortfall
  const toInject = ethers.utils.parseEther("0.5");
  console.log("Injecting", ethers.utils.formatEther(toInject), "more MIM...");
  await (await mim.transfer(LEVERAGE_AMM, toInject)).wait();
  console.log("✓ LeverageAMM MIM now:", ethers.utils.formatEther(await mim.balanceOf(LEVERAGE_AMM)));
  
  // Static call to verify
  console.log("\nStatic call...");
  try {
    await wToken.callStatic.withdraw(wTokenBal, 0);
    console.log("✓ Static call passed!");
  } catch (err: any) {
    // Decode error
    if (err.data) {
      try {
        const iface = new ethers.utils.Interface([
          "error ERC20InsufficientBalance(address sender, uint256 balance, uint256 needed)"
        ]);
        const decoded = iface.parseError(err.data);
        console.log("Still insufficient: has", ethers.utils.formatEther(decoded.args[1]), "needs", ethers.utils.formatEther(decoded.args[2]));
        const stillNeeded = decoded.args[2].sub(decoded.args[1]);
        console.log("Still need:", ethers.utils.formatEther(stillNeeded), "more");
        
        // Inject the rest
        console.log("Injecting remaining...");
        await (await mim.transfer(LEVERAGE_AMM, stillNeeded.add(ethers.utils.parseEther("0.1")))).wait();
        console.log("✓ Injected more. Retrying...");
        
        try {
          await wToken.callStatic.withdraw(wTokenBal, 0);
          console.log("✓ Now static call passes!");
        } catch (e2: any) {
          console.log("Still fails:", e2.reason || e2.message?.slice(0,100));
          return;
        }
      } catch {
        console.log("Error decoding:", err.data?.slice(0, 20));
        return;
      }
    } else {
      console.log("Static call failed:", err.reason || err.message?.slice(0, 150));
      return;
    }
  }
  
  // Actual withdrawal
  console.log("\nExecuting withdrawal...");
  const swethBefore = await sweth.balanceOf(signer.address);
  const mimBefore = await mim.balanceOf(signer.address);
  
  const tx = await wToken.withdraw(wTokenBal, 0, { gasLimit: 3000000 });
  await tx.wait();
  
  const swethAfter = await sweth.balanceOf(signer.address);
  const mimAfter = await mim.balanceOf(signer.address);
  
  console.log("✓ Withdrawal succeeded!");
  console.log("sWETH received:", ethers.utils.formatEther(swethAfter.sub(swethBefore)));
  console.log("MIM remaining:", ethers.utils.formatEther(mimAfter));
  
  // Check StakingVault
  const stakingVault = new ethers.Contract(STAKING_VAULT, [
    "function getCash() view returns (uint256)",
    "function totalBorrows() view returns (uint256)"
  ], signer);
  console.log("\nStakingVault cash:", ethers.utils.formatEther(await stakingVault.getCash()));
  console.log("StakingVault borrows:", ethers.utils.formatEther(await stakingVault.totalBorrows()));
}
main().catch(console.error);
