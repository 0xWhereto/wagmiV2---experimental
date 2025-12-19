import { ethers } from "hardhat";

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  const hubAbi = [
    "function getStorageSlotData(uint256 slot) view returns (bytes32)",
  ];
  
  const hub = new ethers.Contract(HUB_ADDRESS, hubAbi, deployer);

  // All sBTC addresses we've seen
  const sBTCs = [
    "0x2F0324268031E6413280F3B5ddBc4A97639A284a", // token 4
    "0x895d970646bd58C697A2EF855754bd074Ef2018b", // token 5
    "0x221Be78CCE1465946eA17e44aa08C4b756983b5F", // token 8
    "0x1DeFDa524B2B5edB94299775B23d7E3dde1Fbb6C", // token 9
    "0xcb84ade32Bb4E9053F9cA8D641bfD35Cb7Fe1f0c", // token 11
  ];

  for (const addr of sBTCs) {
    const slot = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(["address", "uint256"], [addr, 7])
    );
    const indexData = await hub.getStorageSlotData(slot);
    const index = ethers.BigNumber.from(indexData).toNumber();
    console.log(`${addr}: index = ${index}`);
  }
}

main().catch(console.error);
