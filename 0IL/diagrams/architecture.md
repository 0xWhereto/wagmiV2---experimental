# Architecture Diagrams

## System Overview

```mermaid
graph TB
    subgraph User Layer
        U[User]
    end
    
    subgraph Token Layer
        wETH[wETH Token]
        wBTC[wBTC Token]
        MIM[MIM Stablecoin]
        sMIM[sMIM Staking Token]
    end
    
    subgraph Protocol Layer
        LA[LeverageAMM]
        V3[V3LPVault]
        SV[MIMStakingVault]
        OR[OracleAdapter]
    end
    
    subgraph External Layer
        V3P[Uniswap V3 Pool]
        CL[Chainlink Oracle]
    end
    
    U -->|deposit ETH| wETH
    U -->|deposit BTC| wBTC
    U -->|stake MIM| sMIM
    U -->|mint/redeem| MIM
    
    wETH -->|manage position| LA
    wBTC -->|manage position| LA
    
    LA -->|borrow MIM| SV
    LA -->|add/remove liquidity| V3
    LA -->|get price| OR
    
    SV -->|backed by| MIM
    sMIM -->|represents shares| SV
    
    V3 -->|NFT positions| V3P
    OR -->|TWAP| V3P
    OR -->|validate| CL
```

## Contract Relationships

```mermaid
classDiagram
    class MIM {
        +mint(to, amount)
        +burn(amount)
        +mintWithUSDC(amount)
        +redeemForUSDC(amount)
        +setMinter(minter, allowance)
    }
    
    class MIMStakingVault {
        +deposit(assets) shares
        +withdraw(shares) assets
        +borrow(amount)
        +repay(amount)
        +borrowRate() uint256
        +supplyRate() uint256
    }
    
    class V3LPVault {
        +addLiquidity(amount0, amount1)
        +removeLiquidity(percent)
        +collectFees()
        +rebalance()
        +configureLayers(ranges, weights)
    }
    
    class WToken {
        +deposit(amount, minShares)
        +withdraw(shares, minAssets)
        +depositETH()
        +withdrawETH()
        +pricePerShare()
    }
    
    class LeverageAMM {
        +openPosition(amount)
        +closePosition(shares, total)
        +rebalance()
        +getCurrentDTV()
        +checkRebalance()
    }
    
    class OracleAdapter {
        +getPrice()
        +getTwapPrice()
        +getSpotPrice()
        +setTwapPeriod(period)
    }
    
    MIMStakingVault --> MIM : uses
    WToken --> LeverageAMM : calls
    LeverageAMM --> MIMStakingVault : borrows from
    LeverageAMM --> V3LPVault : manages
    LeverageAMM --> OracleAdapter : price feed
    V3LPVault --> UniswapV3Pool : positions
```

## Deposit Flow

```mermaid
sequenceDiagram
    participant User
    participant WToken
    participant LeverageAMM
    participant StakingVault
    participant V3LPVault
    participant Oracle
    
    User->>WToken: deposit(1 ETH)
    WToken->>WToken: calculateShares()
    WToken->>LeverageAMM: openPosition(1 ETH)
    
    LeverageAMM->>Oracle: getPrice()
    Oracle-->>LeverageAMM: $2000/ETH
    
    Note over LeverageAMM: Value = $2000<br/>Borrow = $2000 (50% DTV)
    
    LeverageAMM->>StakingVault: borrow($2000 MIM)
    StakingVault-->>LeverageAMM: $2000 MIM
    
    LeverageAMM->>V3LPVault: addLiquidity(1 ETH, $2000 MIM)
    
    Note over V3LPVault: Distributes across 4 layers:<br/>40% at ±0.5%<br/>30% at ±1%<br/>20% at ±2%<br/>10% at ±5%
    
    V3LPVault-->>LeverageAMM: liquidity added
    LeverageAMM-->>WToken: position opened
    WToken->>User: mint 1 wETH
```

## Withdrawal Flow

```mermaid
sequenceDiagram
    participant User
    participant WToken
    participant LeverageAMM
    participant StakingVault
    participant V3LPVault
    
    User->>WToken: withdraw(0.5 wETH)
    WToken->>WToken: calculateAssets()
    WToken->>LeverageAMM: closePosition(50%)
    
    LeverageAMM->>V3LPVault: removeLiquidity(50%)
    V3LPVault-->>LeverageAMM: 0.5 ETH + $1000 MIM
    
    LeverageAMM->>StakingVault: repay($1000 MIM)
    
    LeverageAMM-->>WToken: 0.5 ETH
    WToken->>User: burn 0.5 wETH, send 0.5 ETH
```

## Rebalancing Flow

```mermaid
sequenceDiagram
    participant Keeper
    participant LeverageAMM
    participant StakingVault
    participant V3LPVault
    participant Oracle
    
    Note over Keeper: Monitor DTV ratio
    
    Keeper->>LeverageAMM: checkRebalance()
    LeverageAMM->>Oracle: getPrice()
    Oracle-->>LeverageAMM: Price changed
    
    alt Price Increased (DTV < 40%)
        Note over LeverageAMM: Need more leverage
        LeverageAMM->>StakingVault: borrow more MIM
        LeverageAMM->>V3LPVault: addLiquidity(MIM)
    else Price Decreased (DTV > 60%)
        Note over LeverageAMM: Need less leverage
        LeverageAMM->>V3LPVault: removeLiquidity()
        LeverageAMM->>StakingVault: repay MIM
    end
    
    LeverageAMM-->>Keeper: rebalance reward
```

## Interest Rate Model

```mermaid
graph LR
    subgraph Utilization 0-80%
        A[10% base] --> B[+utilization × 12%]
    end
    
    subgraph Utilization 80-90%
        C[19.6% at kink] --> D[+excess × 100%]
    end
    
    subgraph Above 90%
        E[No new borrows]
    end
    
    A --> C
    C --> E
```

## Liquidity Distribution (Curve-Style)

```
                    Liquidity Concentration
                           │
                    ██████████
                   ████████████
                  ██████████████
                 ████████████████
               ████████████████████
             ████████████████████████
           ████████████████████████████
         ████████████████████████████████
    ─────────────────────────────────────────► Price
         -5%    -2%   -1% -0.5% +0.5% +1%   +2%    +5%
         
         Layer 4 (10%)
              Layer 3 (20%)
                   Layer 2 (30%)
                        Layer 1 (40%)
```

## Value Flow

```mermaid
flowchart LR
    subgraph Revenue Sources
        TF[Trading Fees]
        BI[Borrow Interest]
    end
    
    subgraph Distribution
        direction TB
        TF -->|compound| LP[LP Value]
        BI -->|90%| sMIM[sMIM Holders]
        BI -->|10%| TR[Treasury]
    end
    
    subgraph User Returns
        LP --> wETH[wETH Holders]
        LP --> wBTC[wBTC Holders]
    end
```

## Security Model

```mermaid
graph TB
    subgraph Access Control
        Owner[Owner/Multisig]
        Guardian[Guardian]
        Operator[Authorized Operators]
        Public[Public Functions]
    end
    
    subgraph Protected Functions
        Pause[pause/unpause]
        Config[setParameters]
        Emergency[emergencyWithdraw]
    end
    
    subgraph Open Functions
        Deposit[deposit/withdraw]
        Rebalance[rebalance]
        View[view functions]
    end
    
    Owner --> Pause
    Owner --> Config
    Owner --> Emergency
    Guardian --> Pause
    Operator --> Rebalance
    Public --> Deposit
    Public --> View
```

