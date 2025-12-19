import { ethers } from "hardhat";

const HUB_ADDRESS = "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd";

const hubAbi = [
  "function createSyntheticToken(string memory _name, uint8 _decimals) external returns (address)",
  "function owner() view returns (address)",
  "event SyntheticTokenCreated(address indexed tokenAddress, string name, uint8 decimals, uint256 tokenId)",
];

const TOKENS_TO_CREATE = [
  { name: "sWETH", decimals: 18 },
  { name: "sBTC", decimals: 8 },
  { name: "sUSDC", decimals: 6 },
  { name: "sUSDT", decimals: 6 },
];

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);

  const hub = new ethers.Contract(HUB_ADDRESS, hubAbi, deployer);
  
  const owner = await hub.owner();
  console.log(`Hub owner: ${owner}`);

  const createdTokens: Record<string, string> = {};

  for (const token of TOKENS_TO_CREATE) {
    console.log(`\nCreating ${token.name} (${token.decimals} decimals)...`);
    try {
      const tx = await hub.createSyntheticToken(token.name, token.decimals, { gasLimit: 2500000 });
      const receipt = await tx.wait();
      
      // Find the SyntheticTokenCreated event
      const event = receipt.events?.find((e: any) => e.event === "SyntheticTokenCreated");
      if (event) {
        const tokenAddress = event.args?.tokenAddress;
        console.log(`✅ ${token.name} created at: ${tokenAddress}`);
        createdTokens[token.name] = tokenAddress;
      } else {
        // Try to parse from logs manually
        for (const log of receipt.logs) {
          if (log.topics[0] === ethers.utils.id("SyntheticTokenCreated(address,string,uint8,uint256)")) {
            const iface = new ethers.utils.Interface(hubAbi);
            const parsed = iface.parseLog(log);
            console.log(`✅ ${token.name} created at: ${parsed.args.tokenAddress}`);
            createdTokens[token.name] = parsed.args.tokenAddress;
            break;
          }
        }
      }
      
      if (!createdTokens[token.name]) {
        console.log(`✅ ${token.name} created (tx: ${receipt.transactionHash})`);
        console.log("   Check transaction on explorer for token address");
      }
    } catch (e: any) {
      console.log(`❌ ${token.name}: ${e.reason || e.message}`);
    }
  }

  console.log("\n========================================");
  console.log("Created Synthetic Tokens:");
  console.log("========================================");
  for (const [name, addr] of Object.entries(createdTokens)) {
    console.log(`${name}: "${addr}",`);
  }
}

main().catch(console.error);
