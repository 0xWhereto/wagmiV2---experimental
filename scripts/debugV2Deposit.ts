import { ethers } from "hardhat";

// V2 Final deployment
const MIM = "0x9dEb5301967DD118D9F37181EB971d1136a72635";
const STAKING_VAULT = "0xdeF5851B6C14559c47bf7cC98BACBeC9D31eb968";
const POOL = "0x863EaD6f618456AdeBE876Abce952D4240500e62";
const ORACLE = "0x84Ff35C5644EB8865Efc964D319F852042031Eb3";
const V3_VAULT = "0x6b922148A19e68c0aC175a8CF2CbF931acC290ca";
const LEVERAGE_AMM = "0x4A5Cb23ad31A81516EcA6f1A4F0C001428335855";
const WTOKEN = "0x65fc75EAe642fd08d11A1A94B9FD3820fEefF11b";
const SWETH = "0x5E501C482952c1F2D58a4294F9A97759968c5125";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Debug V2 Deposit ===\n");
  
  const sweth = new ethers.Contract(SWETH, [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address,uint256)"
  ], signer);
  
  const wToken = (await ethers.getContractFactory("WToken")).attach(WTOKEN);
  const leverageAMM = (await ethers.getContractFactory("LeverageAMMV2")).attach(LEVERAGE_AMM);
  const stakingVault = (await ethers.getContractFactory("MIMStakingVaultV2")).attach(STAKING_VAULT);
  const v3Vault = (await ethers.getContractFactory("V3LPVault")).attach(V3_VAULT);
  const oracle = (await ethers.getContractFactory("SimpleOracle")).attach(ORACLE);
  
  console.log("1. Check configurations:");
  console.log("   LeverageAMM.wToken:", await leverageAMM.wToken());
  console.log("   LeverageAMM.underlyingIsToken0:", await leverageAMM.underlyingIsToken0());
  console.log("   StakingVault.isBorrower:", await stakingVault.isBorrower(LEVERAGE_AMM));
  console.log("   V3Vault.isOperator:", await v3Vault.isOperator(LEVERAGE_AMM));
  console.log("   StakingVault.cash:", ethers.utils.formatEther(await stakingVault.getCash()));
  
  console.log("\n2. Check oracle:");
  try {
    const price = await oracle.getPrice();
    console.log("   Oracle price:", ethers.utils.formatEther(price), "MIM per sWETH");
  } catch (e: any) {
    console.log("   Oracle.getPrice() failed:", e.reason || e.message?.slice(0, 100));
  }
  
  console.log("\n3. Check V3Vault layers:");
  try {
    for (let i = 0; i < 4; i++) {
      const layer = await v3Vault.layers(i);
      console.log(`   Layer ${i}: tokenId=${layer.tokenId.toString()}, ticks=[${layer.tickLower}, ${layer.tickUpper}]`);
    }
  } catch (e) {
    console.log("   Could not read layers");
  }
  
  console.log("\n4. Attempting deposit...");
  const depositAmount = ethers.utils.parseEther("0.0001");
  
  await (await sweth.approve(WTOKEN, depositAmount)).wait();
  
  try {
    await wToken.callStatic.deposit(depositAmount, 0);
    console.log("   Static call succeeded!");
  } catch (e: any) {
    console.log("   Static call failed");
    if (e.data) {
      console.log("   Error data:", e.data.slice(0, 20));
      
      // Decode known errors
      const selectors: {[k:string]: string} = {
        "0xa0640723": "ExceedsMaxUtilization",
        "0xe450d38c": "ERC20InsufficientBalance",
        "0x1f2a2005": "ZeroAmount"
      };
      if (selectors[e.data.slice(0, 10)]) {
        console.log("   Error:", selectors[e.data.slice(0, 10)]);
      }
    }
    console.log("   Reason:", e.reason || "none");
  }
  
  // Check pool state
  console.log("\n5. Check pool state:");
  const poolContract = new ethers.Contract(POOL, [
    "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
    "function token0() view returns (address)",
    "function token1() view returns (address)",
    "function liquidity() view returns (uint128)"
  ], signer);
  
  try {
    const slot0 = await poolContract.slot0();
    const liquidity = await poolContract.liquidity();
    console.log("   sqrtPriceX96:", slot0.sqrtPriceX96.toString());
    console.log("   tick:", slot0.tick);
    console.log("   liquidity:", liquidity.toString());
    console.log("   token0:", await poolContract.token0());
    console.log("   token1:", await poolContract.token1());
  } catch (e: any) {
    console.log("   Could not read pool:", e.message?.slice(0, 100));
  }
}
main().catch(console.error);
