import { EndpointId } from "@layerzerolabs/lz-definitions";
import type { OAppOmniGraphHardhat, OmniPointHardhat } from "@layerzerolabs/toolbox-hardhat";

// Sonic Hub Contract
const sonicHub: OmniPointHardhat = {
  eid: EndpointId.SONIC_V2_MAINNET,
  contractName: "SyntheticTokenHub",
  address: "0x7ED2cCD9C9a17eD939112CC282D42c38168756Dd",
};

// Gateway Vaults on each chain (NEW GATEWAYS)
const arbitrumGateway: OmniPointHardhat = {
  eid: EndpointId.ARBITRUM_V2_MAINNET,
  contractName: "GatewayVault",
  address: "0x187ddD9a94236Ba6d22376eE2E3C4C834e92f34e", // NEW GATEWAY
};

const baseGateway: OmniPointHardhat = {
  eid: EndpointId.BASE_V2_MAINNET,
  contractName: "GatewayVault",
  address: "0xB712543E7fB87C411AAbB10c6823cf39bbEBB4Bb", // NEW GATEWAY
};

const ethereumGateway: OmniPointHardhat = {
  eid: EndpointId.ETHEREUM_V2_MAINNET,
  contractName: "GatewayVault",
  address: "0xba36FC6568B953f691dd20754607590C59b7646a", // NEW GATEWAY
};

const config: OAppOmniGraphHardhat = {
  contracts: [
    { contract: sonicHub },
    { contract: arbitrumGateway },
    { contract: baseGateway },
    { contract: ethereumGateway },
  ],
  connections: [
    // Arbitrum Gateway <-> Sonic Hub
    {
      from: arbitrumGateway,
      to: sonicHub,
      config: {
        sendLibrary: "0x975bcD720be66659e3EB3C0e4F1866a3020E493A",
        receiveLibraryConfig: { 
          receiveLibrary: "0x7B9E184e07a6EE1aC23eAe0fe8D6Be2f663f05e6", 
          gracePeriod: 0n 
        },
        sendConfig: {
          executorConfig: { 
            maxMessageSize: 10000, 
            executor: "0x31CAe3B7fB82d847621859fb1585353c5720660D" 
          },
          ulnConfig: {
            confirmations: 20n,
            requiredDVNs: ["0x2f55c492897526677c5b68fb199ea31e2c126416"],
            optionalDVNs: [],
            optionalDVNThreshold: 0,
          },
        },
        receiveConfig: {
          ulnConfig: {
            confirmations: 20n,
            requiredDVNs: ["0x2f55c492897526677c5b68fb199ea31e2c126416"],
            optionalDVNs: [],
            optionalDVNThreshold: 0,
          },
        },
      },
    },
    {
      from: sonicHub,
      to: arbitrumGateway,
      config: {
        sendLibrary: "0xC39161c743D0307EB9BCc9FEF03eeb9Dc4802de7",
        receiveLibraryConfig: { 
          receiveLibrary: "0xe1844c5D63a9543023008D332Bd3d2e6f1FE1043", 
          gracePeriod: 0n 
        },
        sendConfig: {
          executorConfig: { 
            maxMessageSize: 10000, 
            executor: "0x4208D6E27538189bB48E603D6123A94b8Abe0A0b" 
          },
          ulnConfig: {
            confirmations: 20n,
            requiredDVNs: ["0x282b3386571f7f794450d5789911a9804fa346b4"],
            optionalDVNs: [],
            optionalDVNThreshold: 0,
          },
        },
        receiveConfig: {
          ulnConfig: {
            confirmations: 20n,
            requiredDVNs: ["0x282b3386571f7f794450d5789911a9804fa346b4"],
            optionalDVNs: [],
            optionalDVNThreshold: 0,
          },
        },
      },
    },
    // Base Gateway <-> Sonic Hub
    {
      from: baseGateway,
      to: sonicHub,
      config: {
        sendLibrary: "0xB5320B0B3a13cC860893E2Bd79FCd7e13484Dda2",
        receiveLibraryConfig: { 
          receiveLibrary: "0xc70AB6f32772f59fBfc23889Caf4Ba3376C84bAf", 
          gracePeriod: 0n 
        },
        sendConfig: {
          executorConfig: { 
            maxMessageSize: 10000, 
            executor: "0x2CCA08ae69E0C44b18a57Ab2A87644234dAebaE4" 
          },
          ulnConfig: {
            confirmations: 20n,
            requiredDVNs: ["0x9e059a54699a285714207b43b055483e78faac25"],
            optionalDVNs: [],
            optionalDVNThreshold: 0,
          },
        },
        receiveConfig: {
          ulnConfig: {
            confirmations: 20n,
            requiredDVNs: ["0x9e059a54699a285714207b43b055483e78faac25"],
            optionalDVNs: [],
            optionalDVNThreshold: 0,
          },
        },
      },
    },
    {
      from: sonicHub,
      to: baseGateway,
      config: {
        sendLibrary: "0xC39161c743D0307EB9BCc9FEF03eeb9Dc4802de7",
        receiveLibraryConfig: { 
          receiveLibrary: "0xe1844c5D63a9543023008D332Bd3d2e6f1FE1043", 
          gracePeriod: 0n 
        },
        sendConfig: {
          executorConfig: { 
            maxMessageSize: 10000, 
            executor: "0x4208D6E27538189bB48E603D6123A94b8Abe0A0b" 
          },
          ulnConfig: {
            confirmations: 20n,
            requiredDVNs: ["0x282b3386571f7f794450d5789911a9804fa346b4"],
            optionalDVNs: [],
            optionalDVNThreshold: 0,
          },
        },
        receiveConfig: {
          ulnConfig: {
            confirmations: 20n,
            requiredDVNs: ["0x282b3386571f7f794450d5789911a9804fa346b4"],
            optionalDVNs: [],
            optionalDVNThreshold: 0,
          },
        },
      },
    },
    // Ethereum Gateway <-> Sonic Hub
    {
      from: ethereumGateway,
      to: sonicHub,
      config: {
        sendLibrary: "0xbB2Ea70C9E858123480642Cf96acbcCE1372dCe1",
        receiveLibraryConfig: { 
          receiveLibrary: "0xc02Ab410f0734EFa3F14628780e6e695156024C2", 
          gracePeriod: 0n 
        },
        sendConfig: {
          executorConfig: { 
            maxMessageSize: 10000, 
            executor: "0x173272739Bd7Aa6e4e214714048a9fE699453059" 
          },
          ulnConfig: {
            confirmations: 20n,
            requiredDVNs: ["0x589dedbd617e0cbcb916a9223f4d1300c294236b"],
            optionalDVNs: [],
            optionalDVNThreshold: 0,
          },
        },
        receiveConfig: {
          ulnConfig: {
            confirmations: 20n,
            requiredDVNs: ["0x589dedbd617e0cbcb916a9223f4d1300c294236b"],
            optionalDVNs: [],
            optionalDVNThreshold: 0,
          },
        },
      },
    },
    {
      from: sonicHub,
      to: ethereumGateway,
      config: {
        sendLibrary: "0xC39161c743D0307EB9BCc9FEF03eeb9Dc4802de7",
        receiveLibraryConfig: { 
          receiveLibrary: "0xe1844c5D63a9543023008D332Bd3d2e6f1FE1043", 
          gracePeriod: 0n 
        },
        sendConfig: {
          executorConfig: { 
            maxMessageSize: 10000, 
            executor: "0x4208D6E27538189bB48E603D6123A94b8Abe0A0b" 
          },
          ulnConfig: {
            confirmations: 20n,
            requiredDVNs: ["0x282b3386571f7f794450d5789911a9804fa346b4"],
            optionalDVNs: [],
            optionalDVNThreshold: 0,
          },
        },
        receiveConfig: {
          ulnConfig: {
            confirmations: 20n,
            requiredDVNs: ["0x282b3386571f7f794450d5789911a9804fa346b4"],
            optionalDVNs: [],
            optionalDVNThreshold: 0,
          },
        },
      },
    },
  ],
};

export default config;

