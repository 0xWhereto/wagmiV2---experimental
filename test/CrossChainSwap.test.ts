import { expect } from "chai";
import { deployments, ethers } from "hardhat";
import { Contract, ContractFactory } from "ethers";
import { Options } from "@layerzerolabs/lz-v2-utilities";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("Cross Chain Swap Tests", function () {
  let mockERC20Factory: ContractFactory;
  let mockUniV3Factory: ContractFactory;
  let mockNFTPositionManager: ContractFactory;
  let EndpointV2MockFactory: ContractFactory;
  let testSwapReceiverFactory: ContractFactory;
  let testSwapSenderFactory: ContractFactory;

  // Chain A (Receiver)
  let endpointA: Contract;
  let receiverContract: Contract;
  let uniswapFactoryA: Contract;
  let positionManagerA: Contract;
  let tokenAs: string;
  let tokenBs: string;

  // Chain B (Sender)
  let endpointB: Contract;
  let senderContractB: Contract;

  // Chain C (Sender)
  let endpointC: Contract;
  let senderContractC: Contract;

  // EIDs for networks
  const EID_A = 1;
  const EID_B = 2;
  const EID_C = 3;

  let owner: SignerWithAddress;
  let endpointOwner: SignerWithAddress;
  let user: SignerWithAddress;

  beforeEach(async function () {
    [owner, endpointOwner, user] = await ethers.getSigners();

    // Get contract factories
    mockUniV3Factory = await ethers.getContractFactory("MockUniswapV3Factory");
    mockNFTPositionManager = await ethers.getContractFactory("MockNonfungiblePositionManager");

    // Create EndpointV2MockFactory using artifact
    const EndpointV2MockArtifact = await deployments.getArtifact("EndpointV2Mock");
    EndpointV2MockFactory = new ContractFactory(
      EndpointV2MockArtifact.abi,
      EndpointV2MockArtifact.bytecode,
      endpointOwner
    );

    testSwapReceiverFactory = await ethers.getContractFactory("TestCrossChainSwapReceiver");
    testSwapSenderFactory = await ethers.getContractFactory("TestCrossChainSwapSender");

    // Deploy contracts in Chain A
    endpointA = await EndpointV2MockFactory.deploy(EID_A);
    uniswapFactoryA = await mockUniV3Factory.deploy();
    positionManagerA = await mockNFTPositionManager.deploy(uniswapFactoryA.address);

    receiverContract = await testSwapReceiverFactory.deploy(
      uniswapFactoryA.address,
      positionManagerA.address,
      endpointA.address
    );

    // Get synthetic token addresses from receiverContract
    tokenAs = await receiverContract.tokenA();
    tokenBs = await receiverContract.tokenB();

    // Deploy contracts in Chain B
    endpointB = await EndpointV2MockFactory.deploy(EID_B);
    senderContractB = await testSwapSenderFactory.deploy(endpointB.address, EID_A, tokenAs, tokenBs);

    // Deploy contracts in Chain C
    endpointC = await EndpointV2MockFactory.deploy(EID_C);
    senderContractC = await testSwapSenderFactory.deploy(endpointC.address, EID_A, tokenAs, tokenBs);

    // Configure endpoints for message proxying
    await endpointA.setDestLzEndpoint(senderContractB.address, endpointB.address);
    await endpointA.setDestLzEndpoint(senderContractC.address, endpointC.address);
    await endpointB.setDestLzEndpoint(receiverContract.address, endpointA.address);
    await endpointC.setDestLzEndpoint(receiverContract.address, endpointA.address);

    const receiverContractAddressBytes32 = ethers.utils.zeroPad(receiverContract.address, 32);
    const senderContractBAddressBytes32 = ethers.utils.zeroPad(senderContractB.address, 32);
    const senderContractCAddressBytes32 = ethers.utils.zeroPad(senderContractC.address, 32);

    // Set up peers for communication between endpoints
    await receiverContract.setPeer(EID_B, senderContractBAddressBytes32);
    await receiverContract.setPeer(EID_C, senderContractCAddressBytes32);
    await senderContractB.setPeer(EID_A, receiverContractAddressBytes32);
    await senderContractC.setPeer(EID_A, receiverContractAddressBytes32);
  });

  it("Should successfully swap token through cross-chain B->A->C", async function () {
    // User receives tokens in Chain B
    const amountIn = ethers.utils.parseEther("100");

    await senderContractB.mint1000(user.address);

    const gasLimit = 700000;

    const quoteReceiver = await receiverContract.quote(
      user.address,
      tokenAs,
      tokenBs,
      EID_B,
      EID_C,
      Options.newOptions().addExecutorLzReceiveOption(gasLimit, 0).toHex()
    );

    // Tokens from Chain B
    const tokenA = await senderContractB.tokenA();
    const mockTokenAB = await ethers.getContractAt("MockERC20", tokenA);
    //const balanceAB = await mockTokenAB.balanceOf(user.address);
    //console.log("balanceAB", balanceAB);

    // Set swap parameters for B -> A -> C
    const swapParams = {
      recipient: user.address,
      dstEid: EID_C,
      gasLimit: gasLimit,
      value: quoteReceiver,
      tokenIn: tokenAs,
      tokenOut: tokenBs,
      amountIn: amountIn,
    };

    // Approve token spending
    const mockTokenA = await ethers.getContractAt("MockERC20", tokenA);
    await mockTokenA.connect(user).approve(senderContractB.address, amountIn);

    //await receiverContract.connect(owner).setSimulateError(true);

    const encodedOptions = Options.newOptions()
      .addExecutorLzReceiveOption(gasLimit, BigInt(quoteReceiver) + 100000n)
      .toHex();

    // Get quote for gas payment
    const quote = await senderContractB.quote(swapParams, encodedOptions);

    // Send swap from B -> A -> C
    const tx = await senderContractB.connect(user).send(swapParams, encodedOptions, { value: quote });
    await tx.wait();

    //const balanceAB2 = await mockTokenAB.balanceOf(user.address);
    //console.log("balanceAB2", balanceAB2);

    // Check MessageReceived event in Chain C
    const events = await senderContractC.queryFilter(senderContractC.filters.MessageReceived());
    //console.log("events", events);
    expect(events.length).to.be.greaterThan(0);

    // Check token balance in Chain C
    const mockTokenBC = await ethers.getContractAt("MockERC20", await senderContractC.tokenB());
    const finalBalance = await mockTokenBC.balanceOf(user.address);

    // Expect balance to increase (considering that Uniswap mock does a 1:2 swap)
    expect(finalBalance).to.equal(amountIn.mul(2));
  });
});
