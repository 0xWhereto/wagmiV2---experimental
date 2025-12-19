# Gelato RaaS Outreach - Ready to Send

## Contact Information

- **Website**: https://www.gelato.network/raas
- **Contact Form**: https://www.gelato.network/contact
- **Discord**: https://discord.gg/gelato
- **Email**: raas@gelato.network

---

## Email Template (Copy & Send)

**To**: raas@gelato.network

**Subject**: Wagmi Chain - High-Performance L2 Deployment Request (250ms blocks)

---

Hi Gelato Team,

We are deploying **Wagmi Chain**, a central HUB for our omnichain synthetic token protocol, and we're specifically interested in Gelato's Arbitrum Orbit deployment with **250ms block times** (similar to Aleph Zero EVM).

### About Wagmi Protocol

Wagmi is a cross-chain synthetic token system that:
- Accepts token deposits on multiple spoke chains (Arbitrum, Base, Sonic, Ethereum)
- Mints synthetic tokens on a central HUB chain
- Enables cross-chain swaps via Uniswap V3 pools
- Uses **LayerZero V2** for all cross-chain messaging

### Why We Chose Gelato

- **250ms block times** - Critical for fast deposit/withdrawal UX
- **High TPS** - We expect significant swap volume on the HUB
- **Proven performance** - Aleph Zero EVM demonstrates the capabilities we need

### Technical Requirements

| Requirement | Specification |
|-------------|---------------|
| Stack | Arbitrum Orbit (Rollup mode) |
| Settlement | Ethereum Mainnet |
| Block Time | 250ms (like Aleph Zero EVM) |
| EVM Version | Paris (Solidity 0.8.23) |
| Gas Token | ETH (native) |

### Critical Integration: LayerZero

We **must** have LayerZero Endpoint V2 deployed on Wagmi Chain:
- Our spoke chain contracts already use LayerZero (Arbitrum, Base, Sonic)
- We need an Endpoint ID assigned for Wagmi Chain
- DVN and Executor support required

**Question**: Does Gelato have a partnership with LayerZero for new chain integrations? Can you facilitate the LZ deployment?

### Existing LayerZero Contracts (Reference)

| Chain | Contract | Address |
|-------|----------|---------|
| Sonic | SyntheticTokenHub | 0x1bbcE9Fc68E47Cd3E4B6bC3BE64E271bcDb3edf1 |
| Base | GatewayVault | 0x5AafA963D0D448ba3bE2c5940F1778505AcA9512 |
| Arbitrum | GatewayVault | 0x0b3095Cd06d649b66f38a7a17f02e8Ba000b7baF |

### Infrastructure Needed

- [x] Sequencer (centralized is fine initially)
- [x] RPC endpoints (public + authenticated)
- [x] WebSocket support
- [x] Block explorer (Blockscout preferred)
- [x] Native bridge to Ethereum
- [x] LayerZero integration support

### Questions

1. What is your timeline for deploying a 250ms block time chain?
2. What is the monthly cost for our use case?
3. Can you coordinate LayerZero Endpoint deployment?
4. Do you offer testnet deployment first?
5. What SLA guarantees do you provide?

### Timeline

We are ready to proceed immediately and would like the chain operational within **2-3 weeks** if possible.

Looking forward to discussing this further. Happy to schedule a call at your convenience.

Best regards,
[YOUR NAME]
[YOUR ROLE]
Wagmi Protocol

**Contact**: [YOUR EMAIL]
**Telegram**: [YOUR TELEGRAM] (optional)
**GitHub**: https://github.com/RealWagmi

---

## Checklist Before Sending

- [ ] Replace [YOUR NAME] with your name
- [ ] Replace [YOUR ROLE] with your role
- [ ] Replace [YOUR EMAIL] with your email
- [ ] Replace [YOUR TELEGRAM] with your Telegram handle (optional)
- [ ] Review and adjust any technical requirements if needed
- [ ] Send to: raas@gelato.network

---

## What to Expect

1. **Response time**: Usually 24-48 hours
2. **Next steps**: They'll likely schedule a call to discuss requirements
3. **Deployment time**: ~1-2 weeks after contract signing
4. **LayerZero**: May require separate coordination with LZ team

---

## Parallel Action: Contact LayerZero

While waiting for Gelato's response, also contact LayerZero:

**To**: partnerships@layerzero.network

**Subject**: LayerZero Integration Request - Wagmi Chain (New L2)

Hi LayerZero Team,

We are deploying a new Arbitrum Orbit L2 called "Wagmi Chain" via Gelato RaaS and need LayerZero integration.

**Existing LZ Integration**: We already use LayerZero V2 on Arbitrum, Base, and Sonic for our synthetic token protocol.

**Request**:
1. Endpoint ID assignment for Wagmi Chain
2. Guidance on Endpoint V2 deployment
3. DVN support configuration

Our RaaS provider is Gelato. Can you coordinate with them on the integration?

Best regards,
[YOUR NAME]
Wagmi Protocol

