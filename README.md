# AutoLease Protocol

A Web3 project built on the Stacks blockchain using Clarity smart contracts to enable self-executing lease agreements with automated deposit refunds. This protocol addresses real-world problems in traditional leasing, such as disputes over property conditions, delayed refunds, manual payment processing, and lack of transparency between landlords and tenants. By leveraging blockchain immutability and automation, it ensures trustless execution: rents are paid on time via scheduled transactions, deposits are escrowed and refunded automatically if no damages are verified (e.g., via oracle feeds or on-chain attestations), and disputes are resolved through predefined arbitration logic. This reduces legal costs, minimizes fraud, and streamlines the rental market, particularly for short-term rentals or remote property management. 

The system involves 6 core smart contracts:

1. **LeaseFactory**: A factory contract for deploying instance-specific lease agreements. It initializes new leases with parameters like duration, rent amount, deposit value, and parties involved.
   
2. **LeaseCore**: Manages the lifecycle of a lease—activation, termination, and state transitions (e.g., active, ended, disputed). It integrates with other contracts for enforcement.

3. **DepositEscrow**: Holds the tenant's security deposit in escrow. Automatically refunds the full amount upon lease end if conditions are met (no disputes filed within a grace period); otherwise, holds for arbitration.

4. **RentPayment**: Handles recurring rent payments using STX or SIP-10 tokens. Supports automated deductions and penalties for late payments, with funds transferred to the landlord upon due dates.

5. **ConditionVerifier**: Interfaces with external oracles (e.g., via Stacks' Bitcoin anchoring or traits for off-chain data) to verify property conditions at lease end, such as damage reports or inspections.

6. **DisputeArbiter**: Resolves deposit disputes through a simple on-chain voting or timeout mechanism, allowing partial refunds or deductions based on evidence submitted on-chain.

These contracts use Clarity's safety features for predictability, with traits for composability (e.g., fungible-token for payments). Integration with Stacks enables Bitcoin finality for security.

## README

```
# AutoLease Protocol

## Overview

AutoLease is a decentralized protocol for self-executing lease agreements on the Stacks blockchain, powered by Clarity smart contracts. It automates rental processes, including lease initiation, rent collection, deposit escrow, condition verification, and automated refunds, solving key pain points in traditional real estate leasing:

- **Transparency and Trust**: All terms and transactions are on-chain, immutable, and verifiable.
- **Automation**: Smart contracts enforce rules without intermediaries, reducing disputes and costs.
- **Efficiency**: Automated payments and refunds speed up processes; e.g., deposits are refunded if no issues are reported within a set period.
- **Dispute Resolution**: Built-in arbitration for fair handling of claims.
- **Real-World Impact**: Ideal for urban rentals, vacation properties, or global tenants, minimizing fraud and legal fees. Inspired by blockchain rental systems that automate tenancies.

The protocol uses STX for payments and leverages Stacks' integration with Bitcoin for enhanced security.

## Architecture

The system comprises 6 interconnected Clarity smart contracts:

1. **LeaseFactory.clar**: Deploys new lease instances. Functions: `create-lease` (takes params like landlord, tenant, duration, rent, deposit).
   
2. **LeaseCore.clar**: Core lease management. Tracks states (pending, active, ended). Functions: `start-lease`, `end-lease`, integrates with payments and escrow.

3. **DepositEscrow.clar**: Escrows deposits. Functions: `lock-deposit`, `refund-deposit` (auto-triggers on clean end), `claim-damages` (initiates hold).

4. **RentPayment.clar**: Automates rents. Functions: `pay-rent` (recurring via cron-like off-chain triggers or on-chain calls), `apply-late-fee`.

5. **ConditionVerifier.clar**: Verifies end conditions using oracles. Functions: `submit-report` (e.g., from inspectors), `validate-condition`.

6. **DisputeArbiter.clar**: Handles disputes. Functions: `file-dispute`, `resolve-dispute` (e.g., via timeout or multi-sig approval), determines refund amounts.

Contracts use Clarity traits (e.g., for SIP-005 fungible tokens) and follow best practices from Stacks examples like escrow and payment vaults.

## Features

- **Self-Executing Leases**: Terms coded directly; e.g., lease auto-terminates after duration.
- **Deposit Refunds**: Full refund if no dispute filed within 7 days post-lease; partial based on verified damages.
- **Payment Automation**: Rent due dates enforced; non-payment leads to eviction signals.
- **Oracle Integration**: For real-world data like property inspections (extendable via Stacks' Bitcoin ops).
- **Security**: Clarity's decidability prevents reentrancy; audited patterns from community repos.
- **Scalability**: Factory pattern for multiple leases without gas bloat.

## Prerequisites

- Stacks wallet (e.g., Leather or Hiro Wallet) with testnet STX.
- Clarinet CLI for local development and testing.
- Node.js for frontend integration (optional dApp).

## Installation

1. Clone the repo:
   ```
   git clone <this-repo>
   cd autolease-protocol
   ```

2. Install dependencies:
   ```
   npm install  # For any JS utils
   ```

3. Set up Clarinet:
   ```
   cargo install clarinet
   clarinet integrate
   ```

4. Configure `Clarity.toml` for contracts and tests.

## Development

- **Local Testing**: Use Clarinet to simulate blockchain. Run `clarinet test` for unit tests on escrow refunds, payments, etc.
- **Contract Examples**:
  - In `contracts/DepositEscrow.clar`:
    ```clarity
    (define-constant ERR-UNAUTHORIZED (err u1000))
    (define-map escrows {lease-id: uint} {deposit: uint, refunded: bool})

    (define-public (lock-deposit (lease-id: uint) (amount: uint))
      ;; Transfer STX to contract, map storage
      (as-contract (contract-call? .STX-token transfer amount tx-sender (as-contract tx-sender) none))
      (ok {deposit: amount, refunded: false})
    ```
  - Similar for other contracts; full code draws from escrow examples.

- **Deployment**: 
  ```
  clarinet deploy --testnet
  ```
  Fund contracts via wallet; use Stacks Explorer to verify.

## Usage

1. **Create Lease**: Landlord calls `LeaseFactory.create-lease` with terms.
2. **Deposit & Start**: Tenant locks deposit via `DepositEscrow`, lease activates.
3. **Payments**: Automated or manual `RentPayment.pay-rent`.
4. **End Lease**: `LeaseCore.end-lease`; verifier checks conditions.
5. **Refund**: Auto via `DepositEscrow` if clean; else arbitrate.

For dApp: Build frontend with Stacks.js to interact (e.g., sign transactions).

## Security & Audits

- Follow Clarity's safety: No unbounded loops, explicit errors.
- Audit recommended; reference Stacks audit tools.
- Risks: Oracle manipulation (mitigate with multi-oracle), front-running (use commit-reveal).

## Contributing

Fork, PR improvements to contracts or docs. See issues for tasks.

## License

MIT License. See LICENSE file.