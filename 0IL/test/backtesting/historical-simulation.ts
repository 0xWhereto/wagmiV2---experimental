/**
 * 0IL Protocol Backtesting Simulation
 * 
 * This script simulates the performance of the 0IL protocol
 * against historical price data and compares with:
 * - HODL strategy
 * - Traditional LP (Uniswap V2 style)
 * - Traditional LP (Uniswap V3 concentrated)
 */

// ============ Configuration ============

interface SimulationConfig {
  initialInvestment: number;    // USD value
  startDate: Date;
  endDate: Date;
  rebalanceThreshold: number;   // DTV deviation threshold (e.g., 0.10 = 10%)
  targetDTV: number;            // Target debt-to-value (0.50)
  tradingFeeAPR: number;        // Expected trading fee APR
  borrowAPR: number;            // MIM borrow rate
  gasPerRebalance: number;      // USD cost per rebalance
}

interface SimulationResult {
  strategy: string;
  finalValue: number;
  totalReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  rebalanceCount: number;
  totalGasCost: number;
  dailyReturns: number[];
}

// ============ Historical Price Data (ETH/USD) ============

// Simulated daily prices - in production, use real historical data
function generateHistoricalPrices(
  startPrice: number,
  volatility: number,
  days: number,
  trend: number
): number[] {
  const prices: number[] = [startPrice];
  
  for (let i = 1; i < days; i++) {
    const dailyReturn = (Math.random() - 0.5) * 2 * volatility + trend / 365;
    const newPrice = prices[i - 1] * (1 + dailyReturn);
    prices.push(Math.max(newPrice, 1)); // Prevent negative prices
  }
  
  return prices;
}

// Historical ETH prices (simplified - replace with real data)
const ETH_PRICES_2020_2024 = generateHistoricalPrices(
  130,     // Jan 2020 ETH price
  0.05,    // 5% daily volatility
  1460,    // 4 years of daily data
  0.50     // 50% annual trend (roughly matches ETH's growth)
);

// ============ Strategy Implementations ============

/**
 * HODL Strategy: Simply hold the asset
 */
function simulateHODL(
  prices: number[],
  initialValue: number
): SimulationResult {
  const tokenAmount = initialValue / prices[0];
  const dailyValues = prices.map(p => tokenAmount * p);
  const dailyReturns = calculateDailyReturns(dailyValues);
  
  return {
    strategy: 'HODL',
    finalValue: dailyValues[dailyValues.length - 1],
    totalReturn: (dailyValues[dailyValues.length - 1] / initialValue - 1) * 100,
    maxDrawdown: calculateMaxDrawdown(dailyValues),
    sharpeRatio: calculateSharpeRatio(dailyReturns),
    rebalanceCount: 0,
    totalGasCost: 0,
    dailyReturns,
  };
}

/**
 * Traditional AMM LP (Uniswap V2 style)
 * Value = 2 * sqrt(k * p)
 */
function simulateTraditionalLP(
  prices: number[],
  initialValue: number,
  feeAPR: number
): SimulationResult {
  const initialPrice = prices[0];
  const k = (initialValue / 2) * (initialValue / 2 / initialPrice);
  
  const dailyValues: number[] = [];
  
  for (let i = 0; i < prices.length; i++) {
    // LP value formula: 2 * sqrt(k * p)
    let lpValue = 2 * Math.sqrt(k * prices[i]);
    
    // Add trading fees (simplified daily accrual)
    const dayFees = lpValue * (feeAPR / 365);
    lpValue += dayFees;
    
    dailyValues.push(lpValue);
  }
  
  const dailyReturns = calculateDailyReturns(dailyValues);
  
  return {
    strategy: 'Traditional LP (V2)',
    finalValue: dailyValues[dailyValues.length - 1],
    totalReturn: (dailyValues[dailyValues.length - 1] / initialValue - 1) * 100,
    maxDrawdown: calculateMaxDrawdown(dailyValues),
    sharpeRatio: calculateSharpeRatio(dailyReturns),
    rebalanceCount: 0,
    totalGasCost: 0,
    dailyReturns,
  };
}

/**
 * 0IL Leveraged LP Strategy
 * Maintains 50% DTV with rebalancing
 */
function simulate0IL(
  prices: number[],
  initialValue: number,
  config: SimulationConfig
): SimulationResult {
  const initialPrice = prices[0];
  
  // Initial position
  let collateralValue = initialValue;
  let debt = initialValue; // 50% DTV = borrow equal to collateral
  let lpValue = collateralValue + debt; // 2x leverage
  
  // Track for LP value calculation (using constant product)
  let token0Amount = collateralValue / initialPrice; // ETH
  let token1Amount = debt; // MIM (stablecoin)
  
  const dailyValues: number[] = [];
  let rebalanceCount = 0;
  let totalGasCost = 0;
  
  for (let i = 0; i < prices.length; i++) {
    const price = prices[i];
    
    // Calculate current LP value (constant product)
    // For 0IL, we track linearly due to leverage effect
    const token0Value = token0Amount * price;
    lpValue = token0Value + token1Amount;
    
    // Calculate equity (what user owns)
    let equity = lpValue - debt;
    
    // Add trading fees
    const dayFees = lpValue * (config.tradingFeeAPR / 365);
    equity += dayFees * 0.5; // Half of fees go to equity
    
    // Subtract borrow interest
    const dayInterest = debt * (config.borrowAPR / 365);
    equity -= dayInterest;
    debt += dayInterest; // Interest compounds
    
    // Recalculate LP value
    lpValue = equity + debt;
    
    // Check if rebalance needed
    const currentDTV = debt / lpValue;
    
    if (Math.abs(currentDTV - config.targetDTV) > config.rebalanceThreshold) {
      // Rebalance to target DTV
      const targetDebt = lpValue * config.targetDTV;
      
      if (currentDTV < config.targetDTV) {
        // Price went up, borrow more
        const additionalBorrow = targetDebt - debt;
        debt = targetDebt;
        token1Amount += additionalBorrow;
        lpValue = equity + debt;
      } else {
        // Price went down, repay some
        const repayAmount = debt - targetDebt;
        debt = targetDebt;
        token1Amount -= repayAmount;
        lpValue = equity + debt;
      }
      
      rebalanceCount++;
      totalGasCost += config.gasPerRebalance;
      equity -= config.gasPerRebalance;
    }
    
    // Update token amounts for next iteration
    token0Amount = (lpValue / 2) / price;
    token1Amount = lpValue / 2;
    
    dailyValues.push(equity);
  }
  
  const dailyReturns = calculateDailyReturns(dailyValues);
  
  return {
    strategy: '0IL Leveraged LP',
    finalValue: dailyValues[dailyValues.length - 1] - totalGasCost,
    totalReturn: ((dailyValues[dailyValues.length - 1] - totalGasCost) / initialValue - 1) * 100,
    maxDrawdown: calculateMaxDrawdown(dailyValues),
    sharpeRatio: calculateSharpeRatio(dailyReturns),
    rebalanceCount,
    totalGasCost,
    dailyReturns,
  };
}

// ============ Helper Functions ============

function calculateDailyReturns(values: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < values.length; i++) {
    returns.push((values[i] / values[i - 1]) - 1);
  }
  return returns;
}

function calculateMaxDrawdown(values: number[]): number {
  let maxDrawdown = 0;
  let peak = values[0];
  
  for (const value of values) {
    if (value > peak) {
      peak = value;
    }
    const drawdown = (peak - value) / peak;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }
  
  return maxDrawdown * 100;
}

function calculateSharpeRatio(returns: number[]): number {
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  
  // Annualize
  const annualizedReturn = avgReturn * 365;
  const annualizedStdDev = stdDev * Math.sqrt(365);
  const riskFreeRate = 0.04; // 4% annual risk-free rate
  
  return (annualizedReturn - riskFreeRate) / annualizedStdDev;
}

function formatResults(results: SimulationResult[]): void {
  console.log('\n' + '='.repeat(80));
  console.log('BACKTESTING RESULTS');
  console.log('='.repeat(80));
  
  console.log('\n| Strategy | Final Value | Total Return | Max Drawdown | Sharpe Ratio | Rebalances |');
  console.log('|----------|-------------|--------------|--------------|--------------|------------|');
  
  for (const r of results) {
    console.log(
      `| ${r.strategy.padEnd(18)} | $${r.finalValue.toFixed(2).padStart(9)} | ` +
      `${r.totalReturn.toFixed(1).padStart(10)}% | ${r.maxDrawdown.toFixed(1).padStart(10)}% | ` +
      `${r.sharpeRatio.toFixed(2).padStart(12)} | ${r.rebalanceCount.toString().padStart(10)} |`
    );
  }
  
  console.log('\n');
}

// ============ Run Simulation ============

function runBacktest(): void {
  console.log('Starting 0IL Protocol Backtest...\n');
  
  const config: SimulationConfig = {
    initialInvestment: 10000, // $10,000
    startDate: new Date('2020-01-01'),
    endDate: new Date('2024-01-01'),
    rebalanceThreshold: 0.10, // 10% DTV deviation
    targetDTV: 0.50,
    tradingFeeAPR: 0.15, // 15% APR from trading fees
    borrowAPR: 0.15, // 15% borrow rate
    gasPerRebalance: 10, // $10 per rebalance
  };
  
  console.log('Configuration:');
  console.log(`  Initial Investment: $${config.initialInvestment}`);
  console.log(`  Period: ${ETH_PRICES_2020_2024.length} days`);
  console.log(`  Rebalance Threshold: ${config.rebalanceThreshold * 100}%`);
  console.log(`  Trading Fee APR: ${config.tradingFeeAPR * 100}%`);
  console.log(`  Borrow APR: ${config.borrowAPR * 100}%`);
  
  const results: SimulationResult[] = [];
  
  // Run all strategies
  results.push(simulateHODL(ETH_PRICES_2020_2024, config.initialInvestment));
  results.push(simulateTraditionalLP(ETH_PRICES_2020_2024, config.initialInvestment, config.tradingFeeAPR));
  results.push(simulate0IL(ETH_PRICES_2020_2024, config.initialInvestment, config));
  
  // Display results
  formatResults(results);
  
  // Additional analysis
  console.log('Analysis:');
  
  const hodl = results.find(r => r.strategy === 'HODL')!;
  const tradLP = results.find(r => r.strategy.includes('V2'))!;
  const zeroIL = results.find(r => r.strategy === '0IL Leveraged LP')!;
  
  const ilAvoidedVsTrad = zeroIL.finalValue - tradLP.finalValue;
  const outperformanceVsHODL = zeroIL.finalValue - hodl.finalValue;
  
  console.log(`  IL Avoided vs Traditional LP: $${ilAvoidedVsTrad.toFixed(2)}`);
  console.log(`  Outperformance vs HODL: $${outperformanceVsHODL.toFixed(2)}`);
  console.log(`  Total Gas Cost (0IL): $${zeroIL.totalGasCost.toFixed(2)}`);
  console.log(`  Gas Cost as % of Returns: ${((zeroIL.totalGasCost / (zeroIL.finalValue - config.initialInvestment)) * 100).toFixed(2)}%`);
  
  // Price scenarios
  console.log('\n' + '='.repeat(80));
  console.log('SCENARIO ANALYSIS');
  console.log('='.repeat(80));
  
  const scenarios = [
    { name: 'Bull Market (+200%)', prices: generateHistoricalPrices(2000, 0.04, 365, 2.0) },
    { name: 'Bear Market (-50%)', prices: generateHistoricalPrices(2000, 0.04, 365, -0.5) },
    { name: 'Sideways (±5%)', prices: generateHistoricalPrices(2000, 0.02, 365, 0.0) },
    { name: 'High Volatility', prices: generateHistoricalPrices(2000, 0.10, 365, 0.0) },
  ];
  
  console.log('\n| Scenario | HODL | Trad LP | 0IL | 0IL vs HODL |');
  console.log('|----------|------|---------|-----|-------------|');
  
  for (const scenario of scenarios) {
    const h = simulateHODL(scenario.prices, 10000);
    const t = simulateTraditionalLP(scenario.prices, 10000, 0.15);
    const z = simulate0IL(scenario.prices, 10000, config);
    
    console.log(
      `| ${scenario.name.padEnd(20)} | ${h.totalReturn.toFixed(1).padStart(5)}% | ` +
      `${t.totalReturn.toFixed(1).padStart(6)}% | ${z.totalReturn.toFixed(1).padStart(4)}% | ` +
      `${(z.totalReturn - h.totalReturn).toFixed(1).padStart(10)}% |`
    );
  }
  
  console.log('\n✅ Backtest complete!\n');
}

// Run the simulation
runBacktest();

export {
  SimulationConfig,
  SimulationResult,
  simulateHODL,
  simulateTraditionalLP,
  simulate0IL,
  runBacktest,
};


