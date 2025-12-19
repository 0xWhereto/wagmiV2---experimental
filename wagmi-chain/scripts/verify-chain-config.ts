/**
 * Wagmi Chain Configuration Verification Script
 *
 * This script validates the chain configuration before deployment
 * and after the chain is live.
 *
 * Usage:
 *   npx ts-node wagmi-chain/scripts/verify-chain-config.ts
 */

import * as fs from "fs";
import * as path from "path";

interface ChainConfig {
  chain: {
    name: string;
    chainId: number | null;
    type: string;
    settlementLayer: string;
  };
  network: {
    rpcUrl: string | null;
    wsUrl: string | null;
    explorerUrl: string | null;
  };
  technical: {
    evmVersion: string;
    solidityVersion: string;
    blockTimeMs: number;
  };
  layerzero: {
    endpointId: number | null;
    endpointAddress: string;
    sendLibrary: string | null;
    receiveLibrary: string | null;
    executor: string | null;
    dvn: {
      required: string[];
      optional: string[];
      optionalThreshold: number;
    };
  };
  contracts: {
    syntheticTokenHub: { address: string | null };
    balancer: { address: string | null };
    weth9: { address: string | null };
  };
  spokeChains: Array<{
    name: string;
    eid: number;
    gatewayVault: string | null;
    status: string;
  }>;
  deployment: {
    raasProvider: string | null;
    status: string;
  };
}

interface ValidationResult {
  category: string;
  check: string;
  status: "pass" | "fail" | "warning" | "pending";
  message: string;
}

function loadConfig(): ChainConfig {
  const configPath = path.join(
    __dirname,
    "..",
    "config",
    "chain-parameters.json"
  );
  const configContent = fs.readFileSync(configPath, "utf-8");
  return JSON.parse(configContent);
}

function validateConfig(config: ChainConfig): ValidationResult[] {
  const results: ValidationResult[] = [];

  // Chain Configuration Checks
  results.push({
    category: "Chain",
    check: "Chain Name",
    status: config.chain.name ? "pass" : "fail",
    message: config.chain.name || "Chain name not set",
  });

  results.push({
    category: "Chain",
    check: "Chain ID",
    status: config.chain.chainId ? "pass" : "pending",
    message: config.chain.chainId
      ? `Chain ID: ${config.chain.chainId}`
      : "Awaiting RaaS provider assignment",
  });

  results.push({
    category: "Chain",
    check: "Chain Type",
    status: config.chain.type === "arbitrum-orbit-rollup" ? "pass" : "warning",
    message: `Type: ${config.chain.type}`,
  });

  results.push({
    category: "Chain",
    check: "Settlement Layer",
    status:
      config.chain.settlementLayer === "ethereum-mainnet" ? "pass" : "warning",
    message: `Settling to: ${config.chain.settlementLayer}`,
  });

  // Network Configuration Checks
  results.push({
    category: "Network",
    check: "RPC URL",
    status: config.network.rpcUrl ? "pass" : "pending",
    message: config.network.rpcUrl || "Awaiting RaaS provider",
  });

  results.push({
    category: "Network",
    check: "WebSocket URL",
    status: config.network.wsUrl ? "pass" : "pending",
    message: config.network.wsUrl || "Awaiting RaaS provider",
  });

  results.push({
    category: "Network",
    check: "Block Explorer",
    status: config.network.explorerUrl ? "pass" : "pending",
    message: config.network.explorerUrl || "Awaiting deployment",
  });

  // Technical Configuration Checks
  results.push({
    category: "Technical",
    check: "EVM Version",
    status: config.technical.evmVersion === "paris" ? "pass" : "warning",
    message: `EVM: ${config.technical.evmVersion} (required: paris for 0.8.23)`,
  });

  results.push({
    category: "Technical",
    check: "Solidity Version",
    status: config.technical.solidityVersion === "0.8.23" ? "pass" : "fail",
    message: `Solidity: ${config.technical.solidityVersion}`,
  });

  results.push({
    category: "Technical",
    check: "Block Time",
    status:
      config.technical.blockTimeMs >= 100 &&
      config.technical.blockTimeMs <= 2000
        ? "pass"
        : "warning",
    message: `Block time: ${config.technical.blockTimeMs}ms`,
  });

  // LayerZero Configuration Checks
  results.push({
    category: "LayerZero",
    check: "Endpoint ID",
    status: config.layerzero.endpointId ? "pass" : "pending",
    message: config.layerzero.endpointId
      ? `EID: ${config.layerzero.endpointId}`
      : "Awaiting LayerZero assignment",
  });

  results.push({
    category: "LayerZero",
    check: "Endpoint Address",
    status: config.layerzero.endpointAddress ? "pass" : "fail",
    message: `Endpoint: ${config.layerzero.endpointAddress || "Not set"}`,
  });

  results.push({
    category: "LayerZero",
    check: "Send Library",
    status: config.layerzero.sendLibrary ? "pass" : "pending",
    message: config.layerzero.sendLibrary || "Awaiting deployment",
  });

  results.push({
    category: "LayerZero",
    check: "Receive Library",
    status: config.layerzero.receiveLibrary ? "pass" : "pending",
    message: config.layerzero.receiveLibrary || "Awaiting deployment",
  });

  results.push({
    category: "LayerZero",
    check: "DVN Configuration",
    status:
      config.layerzero.dvn.required.length > 0
        ? "pass"
        : config.layerzero.dvn.required.length === 0
          ? "pending"
          : "fail",
    message: `Required DVNs: ${config.layerzero.dvn.required.length}, Optional: ${config.layerzero.dvn.optional.length}`,
  });

  // Contract Deployment Checks
  results.push({
    category: "Contracts",
    check: "SyntheticTokenHub",
    status: config.contracts.syntheticTokenHub.address ? "pass" : "pending",
    message:
      config.contracts.syntheticTokenHub.address || "Awaiting deployment",
  });

  results.push({
    category: "Contracts",
    check: "Balancer",
    status: config.contracts.balancer.address ? "pass" : "pending",
    message: config.contracts.balancer.address || "Awaiting deployment",
  });

  results.push({
    category: "Contracts",
    check: "WETH9",
    status: config.contracts.weth9.address ? "pass" : "pending",
    message: config.contracts.weth9.address || "Awaiting deployment",
  });

  // Spoke Chain Checks
  const activeSpokes = config.spokeChains.filter(
    (s) => s.status === "active" && s.gatewayVault
  );
  results.push({
    category: "Spoke Chains",
    check: "Active Gateways",
    status: activeSpokes.length > 0 ? "pass" : "warning",
    message: `${activeSpokes.length} active spoke chains configured`,
  });

  for (const spoke of config.spokeChains) {
    results.push({
      category: "Spoke Chains",
      check: spoke.name,
      status:
        spoke.status === "active" && spoke.gatewayVault
          ? "pass"
          : spoke.status === "planned"
            ? "pending"
            : "warning",
      message: spoke.gatewayVault
        ? `Gateway: ${spoke.gatewayVault.slice(0, 10)}...`
        : "No gateway configured",
    });
  }

  // Deployment Status
  results.push({
    category: "Deployment",
    check: "RaaS Provider",
    status: config.deployment.raasProvider ? "pass" : "pending",
    message: config.deployment.raasProvider || "Not selected",
  });

  results.push({
    category: "Deployment",
    check: "Overall Status",
    status:
      config.deployment.status === "live"
        ? "pass"
        : config.deployment.status === "planning"
          ? "pending"
          : "warning",
    message: `Status: ${config.deployment.status}`,
  });

  return results;
}

function printResults(results: ValidationResult[]): void {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║         WAGMI CHAIN CONFIGURATION VERIFICATION             ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  const categories = [...new Set(results.map((r) => r.category))];

  const statusIcons = {
    pass: "✅",
    fail: "❌",
    warning: "⚠️ ",
    pending: "⏳",
  };

  for (const category of categories) {
    console.log(`\n📁 ${category}`);
    console.log("─".repeat(60));

    const categoryResults = results.filter((r) => r.category === category);
    for (const result of categoryResults) {
      const icon = statusIcons[result.status];
      console.log(`  ${icon} ${result.check.padEnd(25)} ${result.message}`);
    }
  }

  // Summary
  const summary = {
    pass: results.filter((r) => r.status === "pass").length,
    fail: results.filter((r) => r.status === "fail").length,
    warning: results.filter((r) => r.status === "warning").length,
    pending: results.filter((r) => r.status === "pending").length,
  };

  console.log("\n" + "═".repeat(60));
  console.log("SUMMARY");
  console.log("─".repeat(60));
  console.log(`  ✅ Passed:   ${summary.pass}`);
  console.log(`  ❌ Failed:   ${summary.fail}`);
  console.log(`  ⚠️  Warnings: ${summary.warning}`);
  console.log(`  ⏳ Pending:  ${summary.pending}`);
  console.log("═".repeat(60));

  if (summary.fail > 0) {
    console.log("\n⛔ Configuration has failures that must be resolved.\n");
    process.exit(1);
  } else if (summary.pending > 0) {
    console.log("\n📋 Configuration is incomplete. Complete pending items.\n");
  } else {
    console.log("\n✅ Configuration is complete and ready for deployment!\n");
  }
}

async function main() {
  try {
    const config = loadConfig();
    const results = validateConfig(config);
    printResults(results);
  } catch (error) {
    console.error("Error loading configuration:", error);
    process.exit(1);
  }
}

main();

