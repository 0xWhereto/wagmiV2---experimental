import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { config } from './config';
import { KeeperService } from './services/keeperService';

const app = express();
const keeper = new KeeperService();

// Middleware
app.use(cors({ origin: config.api.corsOrigins }));
app.use(express.json());

// ============ API Endpoints ============

/**
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    keeper: keeper.getState(),
  });
});

/**
 * Get protocol stats
 */
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await keeper.getProtocolStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get keeper status
 */
app.get('/api/keeper/status', async (req, res) => {
  try {
    const state = keeper.getState();
    const balance = await keeper.getBalance();
    const address = keeper.getAddress();

    res.json({
      address,
      balance: balance + ' S',
      state,
      nextCycleCheck: new Date(state.lastCheck + config.keeper.checkInterval).toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Manually trigger cycle payment check
 */
app.post('/api/keeper/check-cycle', async (req, res) => {
  try {
    const result = await keeper.checkAndExecuteCyclePayment();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Manually trigger rebalance check
 */
app.post('/api/keeper/check-rebalance', async (req, res) => {
  try {
    const result = await keeper.checkAndExecuteRebalance();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Manually collect fees
 */
app.post('/api/keeper/collect-fees', async (req, res) => {
  try {
    const result = await keeper.collectFees();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Run full keeper cycle manually
 */
app.post('/api/keeper/run-cycle', async (req, res) => {
  try {
    await keeper.runKeeperCycle();
    res.json({ success: true, message: 'Keeper cycle executed' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ Cron Jobs ============

// Check every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  console.log('Running scheduled keeper check...');
  await keeper.runKeeperCycle();
});

// Also check every hour for fee collection
cron.schedule('0 * * * *', async () => {
  console.log('Running hourly fee collection...');
  await keeper.collectFees();
});

// ============ Startup ============

async function main() {
  console.log(`
  ╔═══════════════════════════════════════════════════════════╗
  ║             0IL PROTOCOL KEEPER SERVICE                   ║
  ║                                                           ║
  ║  Handles:                                                 ║
  ║    - 7-hour cycle fee payments                            ║
  ║    - DTV rebalancing (40-60% range)                       ║
  ║    - V3 fee collection                                    ║
  ╚═══════════════════════════════════════════════════════════╝
  `);

  // Check configuration
  if (!config.privateKey) {
    console.error('ERROR: PRIVATE_KEY not set in environment!');
    process.exit(1);
  }

  // Start server
  app.listen(config.api.port, () => {
    console.log(`Keeper API running on port ${config.api.port}`);
    console.log(`Keeper address: ${keeper.getAddress()}`);
    console.log(`Check interval: ${config.keeper.checkInterval / 1000} seconds`);
    console.log(`Cycle duration: ${config.keeper.cycleDuration / 3600} hours`);
    console.log('');
    console.log('API Endpoints:');
    console.log('  GET  /health               - Health check');
    console.log('  GET  /api/stats            - Protocol stats');
    console.log('  GET  /api/keeper/status    - Keeper status');
    console.log('  POST /api/keeper/check-cycle    - Check and execute cycle payment');
    console.log('  POST /api/keeper/check-rebalance - Check and execute rebalance');
    console.log('  POST /api/keeper/collect-fees   - Collect V3 fees');
    console.log('  POST /api/keeper/run-cycle      - Run full keeper cycle');
    console.log('');
  });

  // Run initial check
  console.log('Running initial keeper check...');
  await keeper.runKeeperCycle();
}

main().catch(console.error);
