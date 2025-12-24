import { ethers, Contract, Wallet, providers } from 'ethers';
import { config, ABIS } from '../config';

interface KeeperState {
  lastCheck: number;
  lastCyclePayment: number;
  lastRebalance: number;
  lastFeeCollection: number;
  consecutiveErrors: number;
  isRunning: boolean;
}

interface ProtocolStats {
  stakingVault: {
    cash: string;
    totalBorrows: string;
    utilizationRate: string;
    borrowRate: string;
    supplyRate: string;
    isCycleDue: boolean;
    timeUntilCycle: number;
  };
  leverageAMM: {
    dtv: string;
    lpValue: string;
    totalDebt: string;
    accumulatedFees: string;
    expectedInterest: string;
    canPayFull: boolean;
    shortfall: string;
    needsRebalance: boolean;
    isDeleverage: boolean;
  };
  v3LPVault: {
    totalAssets: [string, string];
    pendingFees: [string, string];
    layerCount: number;
  };
}

export class KeeperService {
  private provider: providers.JsonRpcProvider;
  private wallet: Wallet;
  private stakingVault: Contract;
  private leverageAMM: Contract;
  private v3LPVault: Contract;
  private state: KeeperState;

  constructor() {
    this.provider = new providers.JsonRpcProvider(config.rpcUrl);
    this.wallet = new Wallet(config.privateKey, this.provider);

    this.stakingVault = new Contract(
      config.contracts.stakingVault,
      ABIS.stakingVault,
      this.wallet
    );

    this.leverageAMM = new Contract(
      config.contracts.leverageAMM,
      ABIS.leverageAMM,
      this.wallet
    );

    this.v3LPVault = new Contract(
      config.contracts.v3LPVault,
      ABIS.v3LPVault,
      this.wallet
    );

    this.state = {
      lastCheck: 0,
      lastCyclePayment: 0,
      lastRebalance: 0,
      lastFeeCollection: 0,
      consecutiveErrors: 0,
      isRunning: false,
    };
  }

  /**
   * Get current protocol stats
   */
  async getProtocolStats(): Promise<ProtocolStats> {
    try {
      // Staking Vault stats
      const [cash, totalBorrows, utilRate, borrowRate, supplyRate, isCycleDue, timeUntilCycle] =
        await Promise.all([
          this.stakingVault.getCash(),
          this.stakingVault.totalBorrows(),
          this.stakingVault.utilizationRate(),
          this.stakingVault.borrowRate(),
          this.stakingVault.supplyRate(),
          this.stakingVault.isCyclePaymentDue(),
          this.stakingVault.timeUntilNextCycle(),
        ]);

      // LeverageAMM stats
      const [dtv, lpValue, totalDebt, accFees, expectedInt, canPayResult, rebalanceCheck] =
        await Promise.all([
          this.leverageAMM.getCurrentDTV(),
          this.leverageAMM.getTotalLPValue(),
          this.leverageAMM.totalDebt(),
          this.leverageAMM.accumulatedFees(),
          this.leverageAMM.getExpectedCycleInterest(),
          this.leverageAMM.canPayFullInterest(),
          this.leverageAMM.checkRebalance(),
        ]);

      // V3LP Vault stats
      const [totalAssets, pendingFees, layerCount] = await Promise.all([
        this.v3LPVault.getTotalAssets(),
        this.v3LPVault.getPendingFees(),
        this.v3LPVault.getLayerCount(),
      ]);

      return {
        stakingVault: {
          cash: ethers.utils.formatUnits(cash, 6),
          totalBorrows: ethers.utils.formatUnits(totalBorrows, 6),
          utilizationRate: ethers.utils.formatUnits(utilRate, 16) + '%',
          borrowRate: ethers.utils.formatUnits(borrowRate, 16) + '%',
          supplyRate: ethers.utils.formatUnits(supplyRate, 16) + '%',
          isCycleDue,
          timeUntilCycle: timeUntilCycle.toNumber(),
        },
        leverageAMM: {
          dtv: ethers.utils.formatUnits(dtv, 16) + '%',
          lpValue: ethers.utils.formatUnits(lpValue, 18),
          totalDebt: ethers.utils.formatUnits(totalDebt, 6),
          accumulatedFees: ethers.utils.formatUnits(accFees, 6),
          expectedInterest: ethers.utils.formatUnits(expectedInt, 6),
          canPayFull: canPayResult[0],
          shortfall: ethers.utils.formatUnits(canPayResult[1], 6),
          needsRebalance: rebalanceCheck[0],
          isDeleverage: rebalanceCheck[1],
        },
        v3LPVault: {
          totalAssets: [
            ethers.utils.formatUnits(totalAssets[0], 18),
            ethers.utils.formatUnits(totalAssets[1], 6),
          ],
          pendingFees: [
            ethers.utils.formatUnits(pendingFees[0], 18),
            ethers.utils.formatUnits(pendingFees[1], 6),
          ],
          layerCount: layerCount.toNumber(),
        },
      };
    } catch (error) {
      console.error('Error getting protocol stats:', error);
      throw error;
    }
  }

  /**
   * Check and execute cycle payment
   */
  async checkAndExecuteCyclePayment(): Promise<{ executed: boolean; txHash?: string; error?: string }> {
    try {
      console.log('Checking cycle payment status...');

      const isCycleDue = await this.leverageAMM.isCyclePaymentDue();

      if (!isCycleDue) {
        const timeUntil = await this.stakingVault.timeUntilNextCycle();
        console.log(`Cycle not due. Time until next cycle: ${timeUntil.toNumber()} seconds`);
        return { executed: false };
      }

      console.log('Cycle payment is due! Executing...');

      // First collect fees
      console.log('Collecting fees from V3 positions...');
      const collectTx = await this.leverageAMM.collectAllFees({
        gasLimit: config.keeper.gasLimit,
      });
      await collectTx.wait();
      console.log(`Fees collected. TX: ${collectTx.hash}`);

      // Then process cycle payment
      console.log('Processing cycle payment...');
      const paymentTx = await this.leverageAMM.processCyclePayment({
        gasLimit: config.keeper.gasLimit,
      });
      const receipt = await paymentTx.wait();

      console.log(`Cycle payment processed! TX: ${paymentTx.hash}`);

      this.state.lastCyclePayment = Date.now();
      this.state.consecutiveErrors = 0;

      return { executed: true, txHash: paymentTx.hash };
    } catch (error: any) {
      console.error('Error executing cycle payment:', error);
      this.state.consecutiveErrors++;
      return { executed: false, error: error.message };
    }
  }

  /**
   * Check and execute rebalance
   */
  async checkAndExecuteRebalance(): Promise<{ executed: boolean; txHash?: string; error?: string }> {
    try {
      console.log('Checking rebalance status...');

      const [needsRebalance, isDeleverage] = await this.leverageAMM.checkRebalance();

      if (!needsRebalance) {
        const dtv = await this.leverageAMM.getCurrentDTV();
        console.log(`No rebalance needed. Current DTV: ${ethers.utils.formatUnits(dtv, 16)}%`);
        return { executed: false };
      }

      console.log(`Rebalance needed! Type: ${isDeleverage ? 'Deleverage' : 'Leverage up'}`);

      const tx = await this.leverageAMM.rebalance({
        gasLimit: config.keeper.gasLimit,
      });
      const receipt = await tx.wait();

      console.log(`Rebalance executed! TX: ${tx.hash}`);

      this.state.lastRebalance = Date.now();
      this.state.consecutiveErrors = 0;

      return { executed: true, txHash: tx.hash };
    } catch (error: any) {
      console.error('Error executing rebalance:', error);
      this.state.consecutiveErrors++;
      return { executed: false, error: error.message };
    }
  }

  /**
   * Collect fees from V3 positions
   */
  async collectFees(): Promise<{ executed: boolean; txHash?: string; fees?: [string, string]; error?: string }> {
    try {
      console.log('Collecting fees from V3 positions...');

      const [pending0, pending1] = await this.v3LPVault.getPendingFees();

      if (pending0.isZero() && pending1.isZero()) {
        console.log('No pending fees to collect');
        return { executed: false };
      }

      console.log(`Pending fees: ${ethers.utils.formatUnits(pending0, 18)} token0, ${ethers.utils.formatUnits(pending1, 6)} token1`);

      const tx = await this.leverageAMM.collectAllFees({
        gasLimit: config.keeper.gasLimit,
      });
      const receipt = await tx.wait();

      console.log(`Fees collected! TX: ${tx.hash}`);

      this.state.lastFeeCollection = Date.now();

      return {
        executed: true,
        txHash: tx.hash,
        fees: [
          ethers.utils.formatUnits(pending0, 18),
          ethers.utils.formatUnits(pending1, 6),
        ],
      };
    } catch (error: any) {
      console.error('Error collecting fees:', error);
      return { executed: false, error: error.message };
    }
  }

  /**
   * Run keeper cycle
   */
  async runKeeperCycle(): Promise<void> {
    if (this.state.isRunning) {
      console.log('Keeper cycle already running, skipping...');
      return;
    }

    this.state.isRunning = true;
    this.state.lastCheck = Date.now();

    console.log('\n========================================');
    console.log(`Keeper cycle started at ${new Date().toISOString()}`);
    console.log('========================================\n');

    try {
      // 1. Check and collect fees
      await this.collectFees();

      // 2. Check and execute rebalance
      await this.checkAndExecuteRebalance();

      // 3. Check and execute cycle payment
      await this.checkAndExecuteCyclePayment();

      console.log('\n========================================');
      console.log('Keeper cycle completed successfully');
      console.log('========================================\n');
    } catch (error) {
      console.error('Keeper cycle failed:', error);
    } finally {
      this.state.isRunning = false;
    }
  }

  /**
   * Get keeper state
   */
  getState(): KeeperState {
    return { ...this.state };
  }

  /**
   * Get wallet address
   */
  getAddress(): string {
    return this.wallet.address;
  }

  /**
   * Get wallet balance
   */
  async getBalance(): Promise<string> {
    const balance = await this.provider.getBalance(this.wallet.address);
    return ethers.utils.formatEther(balance);
  }
}
