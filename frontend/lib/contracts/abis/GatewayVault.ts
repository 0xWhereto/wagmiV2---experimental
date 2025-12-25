export const GatewayVaultABI = [
  // Read functions
  {
    inputs: [],
    name: "DST_EID",
    outputs: [{ internalType: "uint32", name: "", type: "uint32" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getAvailableTokenLength",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getAllAvailableTokens",
    outputs: [
      {
        components: [
          { internalType: "bool", name: "onPause", type: "bool" },
          { internalType: "int8", name: "decimalsDelta", type: "int8" },
          { internalType: "address", name: "syntheticTokenAddress", type: "address" },
          { internalType: "address", name: "tokenAddress", type: "address" },
          { internalType: "uint8", name: "tokenDecimals", type: "uint8" },
          { internalType: "string", name: "tokenSymbol", type: "string" },
          { internalType: "uint256", name: "tokenBalance", type: "uint256" },
        ],
        internalType: "struct GatewayVault.TokenDetail[]",
        name: "",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "_tokenAddress", type: "address" }],
    name: "getAllAvailableTokenByAddress",
    outputs: [
      {
        components: [
          { internalType: "bool", name: "onPause", type: "bool" },
          { internalType: "int8", name: "decimalsDelta", type: "int8" },
          { internalType: "address", name: "syntheticTokenAddress", type: "address" },
          { internalType: "address", name: "tokenAddress", type: "address" },
          { internalType: "uint8", name: "tokenDecimals", type: "uint8" },
          { internalType: "string", name: "tokenSymbol", type: "string" },
          { internalType: "uint256", name: "tokenBalance", type: "uint256" },
        ],
        internalType: "struct GatewayVault.TokenDetail",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "_tokenAddress", type: "address" }],
    name: "getTokenIndex",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  // Quote functions
  {
    inputs: [
      { internalType: "address", name: "_recepient", type: "address" },
      {
        components: [
          { internalType: "address", name: "tokenAddress", type: "address" },
          { internalType: "uint256", name: "tokenAmount", type: "uint256" },
        ],
        internalType: "struct Asset[]",
        name: "_assets",
        type: "tuple[]",
      },
      { internalType: "bytes", name: "_options", type: "bytes" },
    ],
    name: "quoteDeposit",
    outputs: [{ internalType: "uint256", name: "nativeFee", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          { internalType: "address", name: "from", type: "address" },
          { internalType: "address", name: "to", type: "address" },
          { internalType: "address", name: "syntheticTokenOut", type: "address" },
          { internalType: "uint128", name: "gasLimit", type: "uint128" },
          { internalType: "uint32", name: "dstEid", type: "uint32" },
          { internalType: "uint256", name: "value", type: "uint256" },
          {
            components: [
              { internalType: "address", name: "tokenAddress", type: "address" },
              { internalType: "uint256", name: "tokenAmount", type: "uint256" },
            ],
            internalType: "struct Asset[]",
            name: "assets",
            type: "tuple[]",
          },
          { internalType: "bytes", name: "commands", type: "bytes" },
          { internalType: "bytes[]", name: "inputs", type: "bytes[]" },
          { internalType: "uint256", name: "minimumAmountOut", type: "uint256" },
        ],
        internalType: "struct SwapParams",
        name: "_swapParams",
        type: "tuple",
      },
      { internalType: "bytes", name: "_options", type: "bytes" },
      {
        components: [
          { internalType: "address", name: "tokenAddress", type: "address" },
          { internalType: "uint256", name: "tokenAmount", type: "uint256" },
        ],
        internalType: "struct Asset[]",
        name: "_assets",
        type: "tuple[]",
      },
    ],
    name: "quoteSwap",
    outputs: [{ internalType: "uint256", name: "nativeFee", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  // Write functions
  {
    inputs: [
      { internalType: "address", name: "_recepient", type: "address" },
      {
        components: [
          { internalType: "address", name: "tokenAddress", type: "address" },
          { internalType: "uint256", name: "tokenAmount", type: "uint256" },
        ],
        internalType: "struct Asset[]",
        name: "_assets",
        type: "tuple[]",
      },
      { internalType: "bytes", name: "_options", type: "bytes" },
    ],
    name: "deposit",
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
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          { internalType: "address", name: "from", type: "address" },
          { internalType: "address", name: "to", type: "address" },
          { internalType: "address", name: "syntheticTokenOut", type: "address" },
          { internalType: "uint128", name: "gasLimit", type: "uint128" },
          { internalType: "uint32", name: "dstEid", type: "uint32" },
          { internalType: "uint256", name: "value", type: "uint256" },
          {
            components: [
              { internalType: "address", name: "tokenAddress", type: "address" },
              { internalType: "uint256", name: "tokenAmount", type: "uint256" },
            ],
            internalType: "struct Asset[]",
            name: "assets",
            type: "tuple[]",
          },
          { internalType: "bytes", name: "commands", type: "bytes" },
          { internalType: "bytes[]", name: "inputs", type: "bytes[]" },
          { internalType: "uint256", name: "minimumAmountOut", type: "uint256" },
        ],
        internalType: "struct SwapParams",
        name: "_swapParams",
        type: "tuple",
      },
      { internalType: "bytes", name: "_options", type: "bytes" },
      {
        components: [
          { internalType: "address", name: "tokenAddress", type: "address" },
          { internalType: "uint256", name: "tokenAmount", type: "uint256" },
        ],
        internalType: "struct Asset[]",
        name: "_assets",
        type: "tuple[]",
      },
    ],
    name: "swap",
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
        name: "",
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
      { indexed: false, internalType: "enum MessageType", name: "messageType", type: "uint8" },
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
    ],
    name: "MessageSent",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: false, internalType: "enum MessageType", name: "messageType", type: "uint8" },
      { indexed: false, internalType: "uint32", name: "srcEid", type: "uint32" },
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
    ],
    name: "MessageReceived",
    type: "event",
  },
] as const;



