import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import * as dotenv from 'dotenv';

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.23',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
      forking: {
        url: process.env.SONIC_RPC_URL || 'https://rpc.soniclabs.com',
        enabled: false, // Enable to fork Sonic
      },
    },
    localhost: {
      url: 'http://127.0.0.1:8545',
    },
    sonic: {
      url: process.env.SONIC_RPC_URL || 'https://rpc.soniclabs.com',
      chainId: 146,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },
};

export default config;
