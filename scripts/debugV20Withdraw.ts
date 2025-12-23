import { ethers } from "hardhat";

const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";
const MIM = "0x84dC0B4EA2f302CCbDe37cFC6a4C434e0Fd08708";
const WTOKEN = "0x7274fF5B9Ac5A673a89610cc58B54d173FfEb8aB";
const LEVERAGE_AMM = "0xB9897871Fb8cBE4767F660a5AE237e37b8b00D2a";
const V3_VAULT = "0x79e781aF3B8994380a3Ec7Cb8eDD3e70d6F7b2E4";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Debug V20 Withdrawal ===\n");
  
  const sweth = new ethers.Contract(SWETH, ["function balanceOf(address) view returns (uint256)"], signer);
  const mim = new ethers.Contract(MIM, ["function balanceOf(address) view returns (uint256)"], signer);
  
  const wToken = new ethers.Contract(WTOKEN, [
    "function balanceOf(address) view returns (uint256)",
    "function totalSupply() view returns (uint256)",
    "function withdraw(uint256,uint256) external returns (uint256)"
  ], signer);
  
  const leverageAMM = new ethers.Contract(LEVERAGE_AMM, [
    "function totalDebt() view returns (uint256)",
    "function totalUnderlying() view returns (uint256)"
  ], signer);
  
  const v3Vault = new ethers.Contract(V3_VAULT, [
    "function getTotalAssets() view returns (uint256, uint256)",
    "function layers(uint256) view returns (int24,int24,uint256,uint256,uint128)",
    "function totalToken0() view returns (uint256)",
    "function totalToken1() view returns (uint256)"
  ], signer);
  
  // Check state
  const wTokenBal = await wToken.balanceOf(signer.address);
  const totalSupply = await wToken.totalSupply();
  const totalDebt = await leverageAMM.totalDebt();
  const totalUnderlying = await leverageAMM.totalUnderlying();
  
  console.log("WToken state:");
  console.log("  User balance:", ethers.utils.formatEther(wTokenBal));
  console.log("  Total supply:", ethers.utils.formatEther(totalSupply));
  
  console.log("\nLeverageAMM state:");
  console.log("  Total debt:", ethers.utils.formatEther(totalDebt), "MIM");
  console.log("  Total underlying:", ethers.utils.formatEther(totalUnderlying), "sWETH");
  
  console.log("\nV3LPVault state:");
  console.log("  sWETH in vault:", ethers.utils.formatEther(await sweth.balanceOf(V3_VAULT)));
  console.log("  MIM in vault:", ethers.utils.formatEther(await mim.balanceOf(V3_VAULT)));
  console.log("  totalToken0:", ethers.utils.formatEther(await v3Vault.totalToken0()));
  console.log("  totalToken1:", ethers.utils.formatEther(await v3Vault.totalToken1()));
  
  const [asset0, asset1] = await v3Vault.getTotalAssets();
  console.log("  getTotalAssets sWETH:", ethers.utils.formatEther(asset0));
  console.log("  getTotalAssets MIM:", ethers.utils.formatEther(asset1));
  
  console.log("\nV3 Layers:");
  for (let i = 0; i < 4; i++) {
    const layer = await v3Vault.layers(i);
    console.log(`  Layer ${i}: tokenId=${layer[3].toString()}, liquidity=${layer[4].toString()}`);
  }
  
  console.log("\nLeverageAMM token balances:");
  console.log("  sWETH:", ethers.utils.formatEther(await sweth.balanceOf(LEVERAGE_AMM)));
  console.log("  MIM:", ethers.utils.formatEther(await mim.balanceOf(LEVERAGE_AMM)));
  
  // Simulate withdrawal
  console.log("\nSimulating withdrawal...");
  try {
    const result = await wToken.callStatic.withdraw(wTokenBal, 0, { gasLimit: 3000000 });
    console.log("SUCCESS! Would receive:", ethers.utils.formatEther(result), "sWETH");
  } catch (err: any) {
    console.log("FAILED!");
    if (err.data) {
      console.log("Error data:", err.data);
      // Decode the error
      const selector = err.data.slice(0, 10);
      console.log("Error selector:", selector);
      if (selector === "0xe450d38c") {
        // ERC20InsufficientBalance(address, uint256, uint256)
        const account = "0x" + err.data.slice(34, 74);
        const balance = ethers.BigNumber.from("0x" + err.data.slice(74, 138));
        const needed = ethers.BigNumber.from("0x" + err.data.slice(138));
        console.log("ERC20InsufficientBalance:");
        console.log("  Account:", account);
        console.log("  Balance:", ethers.utils.formatEther(balance));
        console.log("  Needed:", ethers.utils.formatEther(needed));
      }
    }
    console.log("Reason:", err.reason);
  }
}
main().catch(console.error);
