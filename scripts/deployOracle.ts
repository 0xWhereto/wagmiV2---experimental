import { ethers } from "hardhat";

const SWETH_MIM_POOL = "0x4ed3B3e2AD7e19124D921fE2F6956e1C62Cbf190";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=== Deploy SimpleOracle ===\n");

  // Deploy SimpleOracle
  console.log("Deploying SimpleOracle...");
  const SimpleOracle = await ethers.getContractFactory("SimpleOracle");
  const oracle = await SimpleOracle.deploy(
    SWETH_MIM_POOL,
    18, // sWETH decimals
    18  // MIM decimals
  );
  await oracle.deployed();
  console.log("SimpleOracle:", oracle.address);

  // Verify it works
  const price = await oracle.getPrice();
  console.log("Price (MIM/sWETH):", ethers.utils.formatUnits(price, 18));
}
main().catch(console.error);
