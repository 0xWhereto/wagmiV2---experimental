export const SyntheticTokenHubABI = [
  // Read functions
  {
    inputs: [],
    name: "balancer",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "_recipient", type: "address" },
      {
        components: [
          { internalType: "address", name: "tokenAddress", type: "address" },
          { internalType: "uint256", name: "tokenAmount", type: "uint256" },
        ],
        internalType: "struct Asset[]",
        name: "_assets",
        type: "tuple[]",
      },
      { internalType: "uint32", name: "_dstEid", type: "uint32" },
      { internalType: "bytes", name: "_options", type: "bytes" },
    ],
    name: "quoteBridgeTokens",
    outputs: [
      { internalType: "uint256", name: "nativeFee", type: "uint256" },
      {
        components: [
          { internalType: "address", name: "tokenAddress", type: "address" },
          { internalType: "uint256", name: "tokenAmount", type: "uint256" },
        ],
        internalType: "struct Asset[]",
        name: "assetsRemote",
        type: "tuple[]",
      },
      { internalType: "uint256[]", name: "penalties", type: "uint256[]" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          { internalType: "address", name: "tokenAddress", type: "address" },
          { internalType: "uint256", name: "tokenAmount", type: "uint256" },
        ],
        internalType: "struct Asset[]",
        name: "_assets",
        type: "tuple[]",
      },
      { internalType: "uint32", name: "_dstEid", type: "uint32" },
      { internalType: "bool", name: "_skipMinBridgeAmtCheck", type: "bool" },
    ],
    name: "validateAndPrepareAssets",
    outputs: [
      {
        components: [
          { internalType: "address", name: "tokenAddress", type: "address" },
          { internalType: "uint256", name: "tokenAmount", type: "uint256" },
        ],
        internalType: "struct Asset[]",
        name: "assets",
        type: "tuple[]",
      },
      { internalType: "uint256[]", name: "penalties", type: "uint256[]" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          { internalType: "address", name: "tokenAddress", type: "address" },
          { internalType: "uint256", name: "tokenAmount", type: "uint256" },
        ],
        internalType: "struct Asset[]",
        name: "_assets",
        type: "tuple[]",
      },
      { internalType: "uint32", name: "_srcEid", type: "uint32" },
    ],
    name: "calculateBonuses",
    outputs: [{ internalType: "uint256[]", name: "bonuses", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
  // Write functions
  {
    inputs: [
      { internalType: "address", name: "_recipient", type: "address" },
      {
        components: [
          { internalType: "address", name: "tokenAddress", type: "address" },
          { internalType: "uint256", name: "tokenAmount", type: "uint256" },
        ],
        internalType: "struct Asset[]",
        name: "_assets",
        type: "tuple[]",
      },
      { internalType: "uint32", name: "_dstEid", type: "uint32" },
      { internalType: "bytes", name: "_options", type: "bytes" },
    ],
    name: "bridgeTokens",
    outputs: [
      {
        components: [
          { internalType: "bytes32", name: "guid", type: "bytes32" },
          { internalType: "uint64", name: "nonce", type: "uint64" },
          {
            components: [
              { internalType: "uint256", name: "nativeFee", type: "uint256" },
              { internalType: "uint256", name: "lzTokenFee", type: "uint256" },
            ],
            internalType: "struct MessagingFee",
            name: "fee",
            type: "tuple",
          },
        ],
        internalType: "struct MessagingReceipt",
        name: "receipt",
        type: "tuple",
      },
    ],
    stateMutability: "payable",
    type: "function",
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "tokenIndex", type: "uint256" },
      { indexed: false, internalType: "address", name: "tokenAddress", type: "address" },
      { indexed: false, internalType: "string", name: "symbol", type: "string" },
      { indexed: false, internalType: "uint8", name: "decimals", type: "uint8" },
    ],
    name: "SyntheticTokenAdded",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "tokenIndex", type: "uint256" },
      { indexed: false, internalType: "address", name: "recipient", type: "address" },
      { indexed: false, internalType: "uint256", name: "amount", type: "uint256" },
      { indexed: false, internalType: "uint32", name: "sourceEid", type: "uint32" },
    ],
    name: "TokenMinted",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: false, internalType: "uint32", name: "dstEid", type: "uint32" },
      {
        components: [
          { internalType: "address", name: "tokenAddress", type: "address" },
          { internalType: "uint256", name: "tokenAmount", type: "uint256" },
        ],
        indexed: false,
        internalType: "struct Asset[]",
        name: "assets",
        type: "tuple[]",
      },
    ],
    name: "TokenBurned",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: false, internalType: "uint32", name: "dstEid", type: "uint32" },
      { indexed: false, internalType: "bytes32", name: "guid", type: "bytes32" },
      { indexed: false, internalType: "address", name: "from", type: "address" },
      { indexed: false, internalType: "address", name: "to", type: "address" },
      {
        components: [
          { internalType: "address", name: "tokenAddress", type: "address" },
          { internalType: "uint256", name: "tokenAmount", type: "uint256" },
        ],
        indexed: false,
        internalType: "struct Asset[]",
        name: "assets",
        type: "tuple[]",
      },
      { indexed: false, internalType: "uint256[]", name: "penalties", type: "uint256[]" },
    ],
    name: "MessageSent",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: false, internalType: "bytes32", name: "guid", type: "bytes32" },
      { indexed: false, internalType: "address", name: "from", type: "address" },
      { indexed: false, internalType: "address", name: "to", type: "address" },
      {
        components: [
          { internalType: "address", name: "tokenAddress", type: "address" },
          { internalType: "uint256", name: "tokenAmount", type: "uint256" },
        ],
        indexed: false,
        internalType: "struct Asset[]",
        name: "assets",
        type: "tuple[]",
      },
      { indexed: false, internalType: "uint32", name: "srcEid", type: "uint32" },
    ],
    name: "MessageReceived",
    type: "event",
  },
] as const;



