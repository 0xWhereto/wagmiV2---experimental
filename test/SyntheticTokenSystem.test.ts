import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { Contract, ContractFactory } from "ethers";
import { deployments, ethers } from "hardhat";

import { Options } from "@layerzerolabs/lz-v2-utilities";
import {
  GatewayVault,
  SyntheticTokenHub,
  SyntheticTokenHub__factory,
  GatewayVault__factory,
  SyntheticToken,
} from "../typechain-types";

describe("Synthetic Token System", function () {
  // Constants
  const eidA = 1; // Chain A (Hub chain)
  const eidB = 2; // Chain B (Gateway chain)
  const eidC = 3; // Chain C (Additional Gateway chain)
  const LZ_GAS_LIMIT = 500000; // Gas limit for LayerZero cross-chain messages

  // Contract factories
  let SyntheticTokenHubFactory: SyntheticTokenHub__factory;
  let GatewayVaultFactory: GatewayVault__factory;
  let MockERC20Factory: ContractFactory;
  let EndpointV2MockFactory: ContractFactory;

  // Accounts
  let deployer: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;
  let endpointOwner: SignerWithAddress;
  // Contracts
  let syntheticTokenHub: SyntheticTokenHub;
  let gatewayVault: GatewayVault;
  let gatewayVaultC: GatewayVault; // Additional gateway for multi-chain testing
  let mockEndpointV2A: Contract;
  let mockEndpointV2B: Contract;
  let mockEndpointV2C: Contract;
  let realToken: Contract;
  let realTokenDiffDecimals: Contract;
  let syntheticToken: SyntheticToken;

  before(async function () {
    // Get signers
    const signers = await ethers.getSigners();
    [deployer, user1, user2, user3, endpointOwner] = signers;

    // Get contract factories
    SyntheticTokenHubFactory = await ethers.getContractFactory("SyntheticTokenHub");
    GatewayVaultFactory = await ethers.getContractFactory("GatewayVault");
    MockERC20Factory = await ethers.getContractFactory("MockERC20");

    // Get EndpointV2Mock artifact
    const EndpointV2MockArtifact = await deployments.getArtifact("EndpointV2Mock");
    EndpointV2MockFactory = new ContractFactory(
      EndpointV2MockArtifact.abi,
      EndpointV2MockArtifact.bytecode,
      endpointOwner
    );
  });

  beforeEach(async function () {
    // Deploy mock endpoint instances
    mockEndpointV2A = await EndpointV2MockFactory.deploy(eidA);
    mockEndpointV2B = await EndpointV2MockFactory.deploy(eidB);
    mockEndpointV2C = await EndpointV2MockFactory.deploy(eidC);

    // Create main contracts
    syntheticTokenHub = await SyntheticTokenHubFactory.deploy(mockEndpointV2A.address, deployer.address);
    gatewayVault = await GatewayVaultFactory.deploy(mockEndpointV2B.address, deployer.address, eidA);
    gatewayVaultC = await GatewayVaultFactory.deploy(mockEndpointV2C.address, deployer.address, eidA);

    // Configure endpoints
    await mockEndpointV2A.setDestLzEndpoint(gatewayVault.address, mockEndpointV2B.address);
    await mockEndpointV2B.setDestLzEndpoint(syntheticTokenHub.address, mockEndpointV2A.address);
    await mockEndpointV2A.setDestLzEndpoint(gatewayVaultC.address, mockEndpointV2C.address);
    await mockEndpointV2C.setDestLzEndpoint(syntheticTokenHub.address, mockEndpointV2A.address);

    // Configure connection between contracts
    await syntheticTokenHub.addSupportedChain(eidB, gatewayVault.address);
    await syntheticTokenHub.addSupportedChain(eidC, gatewayVaultC.address);

    // Set trusted peers between contracts (OApp -> OApp)
    // Get address bytes32 for each contract
    const synthTokenHubAddressBytes32 = ethers.utils.zeroPad(syntheticTokenHub.address, 32);
    const gatewayVaultAddressBytes32 = ethers.utils.zeroPad(gatewayVault.address, 32);
    const gatewayVaultCAddressBytes32 = ethers.utils.zeroPad(gatewayVaultC.address, 32);

    // Set SyntheticTokenHub trusted peers
    await syntheticTokenHub.setPeer(eidB, gatewayVaultAddressBytes32);
    await syntheticTokenHub.setPeer(eidC, gatewayVaultCAddressBytes32);

    // Set GatewayVault trusted peers
    await gatewayVault.setPeer(eidA, synthTokenHubAddressBytes32);
    await gatewayVaultC.setPeer(eidA, synthTokenHubAddressBytes32);

    // Initialize tokens
    realToken = await MockERC20Factory.deploy("Real Token", "REAL", 18);
    realTokenDiffDecimals = await MockERC20Factory.deploy("USDC Token", "USDC", 6);

    // Add tokens to GatewayVault
    await gatewayVault.addAvailableTokens([{ tokenAddress: realToken.address, expectedDecimals: 18 }]);
    await gatewayVaultC.addAvailableTokens([{ tokenAddress: realTokenDiffDecimals.address, expectedDecimals: 18 }]);
  });

  // Helper function to setup a test with tokens
  async function setupWithToken() {
    // Add synthetic token
    const tx = await syntheticTokenHub.addSyntheticToken("TEST", 18);
    const receipt = await tx.wait();

    // Find SyntheticTokenAdded event
    const event = receipt.logs.find((log: any) => {
      try {
        const parsed = syntheticTokenHub.interface.parseLog(log);
        return parsed && parsed.name === "SyntheticTokenAdded";
      } catch (e) {
        return false;
      }
    });

    const parsedEvent = event ? syntheticTokenHub.interface.parseLog(event) : null;
    const tokenAddress = parsedEvent ? parsedEvent.args.tokenAddress : null;

    // Create token instance
    syntheticToken = await ethers.getContractAt("SyntheticToken", tokenAddress);

    await realToken.mint(user1.address, ethers.utils.parseEther("1000"));
    await realTokenDiffDecimals.mint(user3.address, ethers.utils.parseUnits("1000", 6));

    // Link tokens
    await syntheticTokenHub.linkRemoteToken(0, eidB, realToken.address, 0);
    await syntheticTokenHub.linkRemoteToken(0, eidC, realTokenDiffDecimals.address, 12); // 6 decimals to 18

    // Add token support in GatewayVault
    await gatewayVault.addAvailableTokens([
      {
        tokenAddress: realToken.address,
        expectedDecimals: 18,
      },
    ]);
    await gatewayVaultC.addAvailableTokens([
      {
        tokenAddress: realTokenDiffDecimals.address,
        expectedDecimals: 18,
      },
    ]);

    // Approve tokens for spending
    await realToken.connect(user1).approve(gatewayVault.address, ethers.constants.MaxUint256);
    await realTokenDiffDecimals.connect(user3).approve(gatewayVaultC.address, ethers.constants.MaxUint256);
  }

  describe("Token Creation and Management", function () {
    it("should successfully create a synthetic token", async function () {
      // Add token
      const tokenSymbol = "BTC";
      const tokenDecimals = 8;

      const tx = await syntheticTokenHub.addSyntheticToken(tokenSymbol, tokenDecimals);
      const receipt = await tx.wait();

      // Find event
      const event = receipt.logs.find((log: any) => {
        try {
          const parsed = syntheticTokenHub.interface.parseLog(log);
          return parsed && parsed.name === "SyntheticTokenAdded";
        } catch (e) {
          return false;
        }
      });

      const parsedEvent = event ? syntheticTokenHub.interface.parseLog(event) : null;
      const tokenAddress = parsedEvent ? parsedEvent.args.tokenAddress : null;

      // Check token was added correctly
      expect(await syntheticTokenHub.syntheticTokenCount()).to.equal(1);

      // Check token properties
      const syntheticToken = await ethers.getContractAt("SyntheticToken", tokenAddress);
      expect(await syntheticToken.symbol()).to.equal(tokenSymbol);
      expect(await syntheticToken.decimals()).to.equal(tokenDecimals);
      expect(await syntheticToken.name()).to.equal(`Synthetic ${tokenSymbol}`);
      expect(await syntheticToken.owner()).to.equal(syntheticTokenHub.address);
    });

    it("should successfully link token with remote token", async function () {
      // Add token
      await syntheticTokenHub.addSyntheticToken("ETH", 18);

      // Add mock token in another network
      const mockEthAddress = "0x1111111111111111111111111111111111111111";
      const decimalsDelta = 0; // Same number of decimal places

      await syntheticTokenHub.linkRemoteToken(0, eidB, mockEthAddress, decimalsDelta);

      // Check token information
      const [tokenView, remoteTokens] = await syntheticTokenHub.getSyntheticTokenInfo(0);
      expect(remoteTokens.length).to.equal(1);
      expect(remoteTokens[0].eid).to.equal(eidB);
      expect(remoteTokens[0].remoteAddress).to.equal(mockEthAddress);
      expect(remoteTokens[0].decimalsDelta).to.equal(decimalsDelta);

      // Check network support
      expect(tokenView.supportedChains.length).to.equal(1);
      expect(tokenView.supportedChains[0]).to.equal(eidB);
    });

    it("should correctly manage pause status", async function () {
      // Add token
      await syntheticTokenHub.addSyntheticToken("USDC", 6);

      // Link with remote token
      const mockUsdcAddress = "0x2222222222222222222222222222222222222222";
      await syntheticTokenHub.linkRemoteToken(0, eidB, mockUsdcAddress, -12); // Remote has 18 decimal places

      // Pause synthetic token
      await syntheticTokenHub.pauseSyntheticToken(0, true);
      const [tokenView, _] = await syntheticTokenHub.getSyntheticTokenInfo(0);
      expect(tokenView.isPaused).to.equal(true);

      // Pause remote token
      await syntheticTokenHub.pauseRemoteToken(0, eidB, true);
      const [__, remoteTokens] = await syntheticTokenHub.getSyntheticTokenInfo(0);
      expect(remoteTokens[0].isPaused).to.equal(true);

      // Unpause both
      await syntheticTokenHub.pauseSyntheticToken(0, false);
      await syntheticTokenHub.pauseRemoteToken(0, eidB, false);

      const [updatedToken, updatedRemotes] = await syntheticTokenHub.getSyntheticTokenInfo(0);
      expect(updatedToken.isPaused).to.equal(false);
      expect(updatedRemotes[0].isPaused).to.equal(false);
    });

    it("should fail when non-owner tries to add a token", async function () {
      await expect(syntheticTokenHub.connect(user1).addSyntheticToken("FAIL", 18)).to.be.reverted;
    });

    it("should fail when non-owner tries to link remote token", async function () {
      // First add a token as owner
      await syntheticTokenHub.addSyntheticToken("TEST", 18);

      // Try linking as non-owner
      await expect(
        syntheticTokenHub.connect(user1).linkRemoteToken(0, eidB, "0x1111111111111111111111111111111111111111", 0)
      ).to.be.reverted;
    });

    it("should fail when trying to link to non-existent token", async function () {
      await expect(syntheticTokenHub.linkRemoteToken(100, eidB, "0x1111111111111111111111111111111111111111", 0)).to.be
        .reverted;
    });

    it("should fail when trying to link to non-existent chain", async function () {
      // Add token
      await syntheticTokenHub.addSyntheticToken("TEST", 18);

      // Try linking to non-existent chain
      await expect(syntheticTokenHub.linkRemoteToken(0, 999, "0x1111111111111111111111111111111111111111", 0)).to.be
        .reverted;
    });

    it("should find token by address", async function () {
      // Убедитесь, что тест запускается после setupWithToken
      await setupWithToken();

      // Теперь ищем по индексу 0, а не по несуществующему индексу
      const index = await syntheticTokenHub.getTokenIndex(syntheticToken.address);
      expect(index).to.equal(0);
    });

    it("should find token by remote address", async function () {
      // Убедитесь, что тест запускается после setupWithToken
      await setupWithToken();

      // Ищем по существующему адресу
      const index = await syntheticTokenHub.getTokenIndexByRemote(eidB, realToken.address);
      expect(index).to.equal(0);
    });

    it("should return chain index by EID", async function () {
      // Check index for a known chain
      const index = await syntheticTokenHub.getChainIndex(eidB);
      expect(index).to.equal(0); // First added chain has index 0
    });

    it("should check if chain is supported", async function () {
      // Check supported chain
      expect(await syntheticTokenHub.isChainSupported(eidB)).to.equal(true);

      // Check unsupported chain
      expect(await syntheticTokenHub.isChainSupported(999)).to.equal(false);
    });
  });

  describe("Chain Management", function () {
    it("should correctly add supported chains", async function () {
      // Get supported chains
      const chains = await syntheticTokenHub.getSupportedChains();
      expect(chains.length).to.equal(2);
      expect(chains[0].eid).to.equal(eidB);
      expect(chains[1].eid).to.equal(eidC);

      // Check chain status
      expect(chains[0].isActive).to.equal(true);
    });

    it("should update chain status correctly", async function () {
      // Update chain status
      await syntheticTokenHub.updateChainStatus(eidB, false);

      // Check updated status
      const chains = await syntheticTokenHub.getSupportedChains();
      expect(chains[0].isActive).to.equal(false);

      // Restore status
      await syntheticTokenHub.updateChainStatus(eidB, true);
      const updatedChains = await syntheticTokenHub.getSupportedChains();
      expect(updatedChains[0].isActive).to.equal(true);
    });

    it("should fail to update non-existent chain", async function () {
      await expect(syntheticTokenHub.updateChainStatus(999, false)).to.be.reverted;
    });

    it("should fail when non-owner tries to add chain", async function () {
      await expect(syntheticTokenHub.connect(user1).addSupportedChain(5, "0x1111111111111111111111111111111111111111"))
        .to.be.reverted;
    });

    it("should fail when adding already supported chain", async function () {
      await expect(syntheticTokenHub.addSupportedChain(eidB, "0x2222222222222222222222222222222222222222")).to.be
        .reverted;
    });
  });

  describe("Synthetic Token Verification", function () {
    it("should have correct initial state", async function () {
      await setupWithToken();

      expect(await syntheticToken.name()).to.equal("Synthetic TEST");
      expect(await syntheticToken.symbol()).to.equal("TEST");
      expect(await syntheticToken.decimals()).to.equal(18);
      expect(await syntheticToken.owner()).to.equal(syntheticTokenHub.address);
      expect(await syntheticToken.totalSupply()).to.equal(0);
    });

    it("should correctly identify as a synthetic token", async function () {
      await setupWithToken();

      expect(await syntheticToken.isSyntheticToken()).to.equal(true);
    });

    it("should not allow non-owner to mint tokens", async function () {
      await expect(syntheticToken.connect(user1).mint(user1.address, ethers.utils.parseEther("100"))).to.be.reverted;
    });

    it("should not allow non-owner to burn tokens", async function () {
      await expect(syntheticToken.connect(user1).burn(user1.address, ethers.utils.parseEther("100"))).to.be.reverted;
    });
  });

  describe("Cross-Chain Token Flow", function () {
    beforeEach(async function () {
      // Setup tokens for each cross-chain test
      await setupWithToken();
    });

    it("should successfully lock tokens in gateway vault", async function () {
      await setupWithToken();

      // Initial balances
      const depositAmount = ethers.utils.parseEther("100");
      expect(await realToken.balanceOf(gatewayVault.address)).to.equal(0);

      // Prepare message sending
      const options = Options.newOptions().addExecutorLzReceiveOption(LZ_GAS_LIMIT, 0).toHex().toString();
      const nativeFee = await gatewayVault.quote(
        user2.address,
        [{ tokenIndex: 0, tokenAmount: depositAmount }],
        options
      );

      // Send tokens from Chain B to Chain A
      await gatewayVault
        .connect(user1)
        .send(user2.address, [{ tokenIndex: 0, tokenAmount: depositAmount }], options, { value: nativeFee });

      // Verify tokens are locked in Gateway on Chain B
      expect(await realToken.balanceOf(gatewayVault.address)).to.equal(depositAmount);
    });

    it("should properly send tokens from gateway to hub and burn synthetic tokens and send them back", async function () {
      // Define deposit amount
      const depositAmount = ethers.utils.parseEther("100");
      const initialBalance = await realToken.balanceOf(user1.address);

      // Calculate message fee
      const options = Options.newOptions().addExecutorLzReceiveOption(LZ_GAS_LIMIT, 0).toHex().toString();
      const nativeFee = await gatewayVault.quote(
        user2.address,
        [{ tokenIndex: 0, tokenAmount: depositAmount }],
        options
      );

      // Send tokens from Chain B to Chain A
      await gatewayVault
        .connect(user1)
        .send(user2.address, [{ tokenIndex: 0, tokenAmount: depositAmount }], options, { value: nativeFee });

      // Verify tokens are transferred from user to vault
      expect(await realToken.balanceOf(user1.address)).to.equal(initialBalance.sub(depositAmount));
      expect(await realToken.balanceOf(gatewayVault.address)).to.equal(depositAmount);
      expect(await syntheticToken.balanceOf(user2.address)).to.equal(depositAmount);

      // Calculate message fee for burning and withdrawal
      const optionsBurn = Options.newOptions().addExecutorLzReceiveOption(LZ_GAS_LIMIT, 0).toHex().toString();
      const nativeFeeBurn = await syntheticTokenHub.quoteBurnAndSend(
        user1.address,
        [{ tokenIndex: 0, tokenAmount: depositAmount }],
        eidB,
        optionsBurn
      );

      // Burn tokens and send message for withdrawal
      await syntheticTokenHub
        .connect(user2)
        .burnAndSend(user1.address, [{ tokenIndex: 0, tokenAmount: depositAmount }], eidB, optionsBurn, {
          value: nativeFeeBurn,
        });

      // Verify tokens were burned
      expect(await syntheticToken.balanceOf(user2.address)).to.equal(0);
      expect(await syntheticToken.totalSupply()).to.equal(0);
      expect(await realToken.balanceOf(user1.address)).to.equal(initialBalance);
    });

    it("should perform full cross-chain token cycle with multi-chain bridging (B->A->C)", async function () {
      // ----- PART 1: SENDING TOKENS FROM CHAIN B TO CHAIN A -----

      // Initial token amount
      const depositAmount = ethers.utils.parseEther("100");
      const depositAmountDiffDecimals = ethers.utils.parseUnits("100", 6);

      // Check initial balances
      const initialBalanceB = await realToken.balanceOf(user1.address);
      const initialBalanceC = await realTokenDiffDecimals.balanceOf(user3.address);
      expect(await syntheticToken.balanceOf(user2.address)).to.equal(0);
      expect(await realToken.balanceOf(gatewayVault.address)).to.equal(0);
      expect(await realTokenDiffDecimals.balanceOf(gatewayVault.address)).to.equal(0);

      // User1 sends tokens from Chain B to Chain A
      const optionsSendB = Options.newOptions().addExecutorLzReceiveOption(LZ_GAS_LIMIT, 0).toHex().toString();
      const nativeFeeSendB = await gatewayVault.quote(
        user2.address,
        [{ tokenIndex: 0, tokenAmount: depositAmount }],
        optionsSendB
      );

      await gatewayVault
        .connect(user1)
        .send(user2.address, [{ tokenIndex: 0, tokenAmount: depositAmount }], optionsSendB, { value: nativeFeeSendB });

      // Verify tokens are locked in Chain B and synthetic tokens created on Chain A
      expect(await realToken.balanceOf(user1.address)).to.equal(initialBalanceB.sub(depositAmount));
      expect(await realToken.balanceOf(gatewayVault.address)).to.equal(depositAmount);
      expect(await syntheticToken.balanceOf(user2.address)).to.equal(depositAmount);

      // ----- PART 2: SENDING TOKENS FROM CHAIN C TO CHAIN A -----

      // User3 sends tokens from Chain C to Chain A
      const optionsSendC = Options.newOptions().addExecutorLzReceiveOption(LZ_GAS_LIMIT, 0).toHex().toString();
      const nativeFeeSendC = await gatewayVaultC.quote(
        user3.address,
        [{ tokenIndex: 0, tokenAmount: depositAmountDiffDecimals }],
        optionsSendC
      );

      await gatewayVaultC
        .connect(user3)
        .send(user2.address, [{ tokenIndex: 0, tokenAmount: depositAmountDiffDecimals }], optionsSendC, {
          value: nativeFeeSendC,
        });

      // Verify tokens are locked in Chain C and synthetic tokens created on Chain A
      expect(await realTokenDiffDecimals.balanceOf(user3.address)).to.equal(
        initialBalanceC.sub(depositAmountDiffDecimals)
      );
      expect(await syntheticToken.balanceOf(user2.address)).to.equal(depositAmount.add(depositAmount));
      expect(await realTokenDiffDecimals.balanceOf(gatewayVaultC.address)).to.equal(depositAmountDiffDecimals);

      // ----- PART 3: SENDING TOKENS FROM CHAIN A TO CHAIN C -----

      const optionsSendA = Options.newOptions().addExecutorLzReceiveOption(LZ_GAS_LIMIT, 0).toHex().toString();
      const nativeFeeSendA = await syntheticTokenHub.quoteBurnAndSend(
        user3.address,
        [{ tokenIndex: 0, tokenAmount: depositAmount }],
        eidC,
        optionsSendA
      );

      // User2 burns synthetic tokens and sends to Chain C
      await syntheticTokenHub
        .connect(user2)
        .burnAndSend(user3.address, [{ tokenIndex: 0, tokenAmount: depositAmount }], eidC, optionsSendC, {
          value: nativeFeeSendA,
        });

      // Verify synthetic tokens were burned on Chain A
      expect(await syntheticToken.balanceOf(user2.address)).to.equal(depositAmount);

      // Verify user3 received real tokens on Chain C (with correct decimals adjustment)
      // Note: realTokenDiffDecimals has 6 decimals, so 100e18 synthetic tokens should be 100e6 real tokens

      expect(await realTokenDiffDecimals.balanceOf(user3.address)).to.equal(initialBalanceC);

      // Chain B real tokens remain locked in the vault (they're still backing the tokens in Chain C)
      expect(await realTokenDiffDecimals.balanceOf(gatewayVaultC.address)).to.equal(0);
    });
  });

  describe("Gateway Vault", function () {
    it("should add supported tokens correctly", async function () {
      // Deploy a test token
      const testToken = await MockERC20Factory.deploy("Test Token", "TEST", 18);

      // Add token support
      await gatewayVault.addAvailableTokens([
        {
          tokenAddress: testToken.address,
          expectedDecimals: 18,
        },
      ]);

      // Check token was added correctly
      const tokenCount = await gatewayVault.getAvailableTokenLength();
      expect(tokenCount).to.equal(2);
    });

    it("should not allow non-owner to add tokens", async function () {
      // Try to add token as non-owner
      await expect(
        gatewayVault.connect(user1).addAvailableTokens([
          {
            tokenAddress: "0x1111111111111111111111111111111111111111",
            expectedDecimals: 18,
          },
        ])
      ).to.be.reverted;
    });

    it("should pause token correctly", async function () {
      // Pause token
      await gatewayVault.pauseToken(0, true);

      // Check token is paused
      const tokenDetail = await gatewayVault.availableTokens(0);
      expect(tokenDetail.onPause).to.equal(true);

      // Unpause token
      await gatewayVault.pauseToken(0, false);
      const updatedToken = await gatewayVault.availableTokens(0);
      expect(updatedToken.onPause).to.equal(false);
    });

    it("should correctly quote transaction fees", async function () {
      await setupWithToken();

      // Define deposit amount
      const depositAmount = ethers.utils.parseEther("100");

      // Calculate message fee with options
      const options = Options.newOptions().addExecutorLzReceiveOption(LZ_GAS_LIMIT, 0).toHex().toString();

      // Get required fee
      const nativeFee = await gatewayVault.quote(
        user2.address,
        [{ tokenIndex: 0, tokenAmount: depositAmount }],
        options
      );

      // Fee should be greater than zero
      expect(nativeFee).to.be.gt(0);
    });
  });

  describe("System Integration", function () {
    it("should get all synthetic tokens correctly", async function () {
      await setupWithToken();

      // Add second token
      await syntheticTokenHub.addSyntheticToken("ETH", 18);

      // Get all tokens
      const tokens = await syntheticTokenHub.getAllSyntheticTokens();
      expect(tokens.length).to.equal(2);
      expect(tokens[0].tokenSymbol).to.equal("TEST");
      expect(tokens[1].tokenSymbol).to.equal("ETH");
    });
  });
});
