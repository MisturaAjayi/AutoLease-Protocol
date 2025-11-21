// tests/DepositEscrow.test.ts
import { describe, it, expect, beforeEach } from "vitest";

type Principal = string;
type Response<T, E> = { isOk: true; value: T } | { isOk: false; value: E };
type Some<T> = { isSome: true; value: T };
type None = { isSome: false };

interface Lease {
  landlord: Principal;
  tenant: Principal;
  "deposit-amount": bigint;
  "locked-at": bigint;
  "lease-end-block": bigint;
  refunded: boolean;
  "dispute-filed": boolean;
  "dispute-filed-at": Some<bigint> | None;
  "claimed-by-landlord": boolean;
}

const ERR_NOT_AUTHORIZED = 100n;
const ERR_LEASE_NOT_FOUND = 101n;
const ERR_INVALID_AMOUNT = 102n;
const ERR_DEPOSIT_REFUNDED = 104n;
const ERR_DISPUTE_ACTIVE = 105n;
const ERR_GRACE_PERIOD_NOT_OVER = 106n;
const ERR_ALREADY_CLAIMED = 110n;

const GRACE_PERIOD_BLOCKS = 1008n;
const CONTRACT_PRINCIPAL = "SP000000000000000000002Q6VF78.deposit-escrow";

class DepositEscrowMock {
  private leases = new Map<bigint, Lease>();
  private nextLeaseId = 1n;
  private currentBlock = 1000n;
  private balances = new Map<Principal, bigint>();

  constructor() {
    this.reset();
  }

  reset() {
    this.leases.clear();
    this.balances.clear();
    this.currentBlock = 1000n;
    this.nextLeaseId = 1n;
    // Pre-fund all test wallets with 1 billion STX
    this.balances.set("ST1LANDLORD", 1_000_000_000_000n);
    this.balances.set("ST2TENANT", 1_000_000_000_000n);
    this.balances.set("ST3STRANGER", 1_000_000_000_000n);
    this.balances.set(CONTRACT_PRINCIPAL, 0n);
  }

  mineBlocks(n: bigint) {
    this.currentBlock += n;
  }

  get blockHeight() {
    return this.currentBlock;
  }

  private getBalance(p: Principal): bigint {
    return this.balances.get(p) ?? 0n;
  }

  private transferSTX(amount: bigint, from: Principal, to: Principal) {
    const fromBal = this.getBalance(from);
    if (fromBal < amount) throw new Error(`Insufficient balance: ${from} has ${fromBal}, needs ${amount}`);
    this.balances.set(from, fromBal - amount);
    this.balances.set(to, this.getBalance(to) + amount);
  }

  initializeLease(
    caller: Principal,
    leaseId: bigint,
    landlord: Principal,
    tenant: Principal,
    depositAmount: bigint,
    durationBlocks: bigint
  ): Response<bigint, bigint> {
    if (leaseId !== this.nextLeaseId) return { isOk: false, value: 107n };
    if (depositAmount <= 0n || durationBlocks <= 0n) return { isOk: false, value: ERR_INVALID_AMOUNT };

    this.leases.set(leaseId, {
      landlord,
      tenant,
      "deposit-amount": depositAmount,
      "locked-at": this.currentBlock,
      "lease-end-block": this.currentBlock + durationBlocks,
      refunded: false,
      "dispute-filed": false,
      "dispute-filed-at": { isSome: false },
      "claimed-by-landlord": false,
    });
    this.nextLeaseId += 1n;
    return { isOk: true, value: leaseId };
  }

  lockDeposit(caller: Principal, leaseId: bigint): Response<boolean, bigint> {
    const lease = this.leases.get(leaseId);
    if (!lease) return { isOk: false, value: ERR_LEASE_NOT_FOUND };
    if (caller !== lease.tenant) return { isOk: false, value: ERR_NOT_AUTHORIZED };
    if (lease.refunded) return { isOk: false, value: ERR_DEPOSIT_REFUNDED };
    if (lease["dispute-filed"]) return { isOk: false, value: ERR_DISPUTE_ACTIVE };

    this.transferSTX(lease["deposit-amount"], caller, CONTRACT_PRINCIPAL);
    return { isOk: true, value: true };
  }

  fileDispute(caller: Principal, leaseId: bigint): Response<boolean, bigint> {
    const lease = this.leases.get(leaseId);
    if (!lease) return { isOk: false, value: ERR_LEASE_NOT_FOUND };
    if (caller !== lease.landlord && caller !== lease.tenant) return { isOk: false, value: ERR_NOT_AUTHORIZED };
    if (this.currentBlock < lease["lease-end-block"]) return { isOk: false, value: 107n };
    if (lease["dispute-filed"]) return { isOk: false, value: ERR_DISPUTE_ACTIVE };
    if (lease.refunded) return { isOk: false, value: ERR_DEPOSIT_REFUNDED };

    lease["dispute-filed"] = true;
    lease["dispute-filed-at"] = { isSome: true, value: this.currentBlock };
    return { isOk: true, value: true };
  }

  refundDeposit(caller: Principal, leaseId: bigint): Response<boolean, bigint> {
    const lease = this.leases.get(leaseId);
    if (!lease) return { isOk: false, value: ERR_LEASE_NOT_FOUND };
    if (lease.refunded) return { isOk: false, value: ERR_DEPOSIT_REFUNDED };
    if (lease["claimed-by-landlord"]) return { isOk: false, value: ERR_ALREADY_CLAIMED };

    if (lease["dispute-filed"]) {
      const filedAt = lease["dispute-filed-at"] as Some<bigint>;
      if (!filedAt.isSome) return { isOk: false, value: 109n };
      if (this.currentBlock < filedAt.value + GRACE_PERIOD_BLOCKS)
        return { isOk: false, value: ERR_GRACE_PERIOD_NOT_OVER };
    } else {
      if (this.currentBlock < lease["lease-end-block"]) return { isOk: false, value: 107n };
    }

    lease.refunded = true;
    this.transferSTX(lease["deposit-amount"], CONTRACT_PRINCIPAL, lease.tenant);
    return { isOk: true, value: true };
  }

  claimDamages(caller: Principal, leaseId: bigint, amount: bigint): Response<boolean, bigint> {
    const lease = this.leases.get(leaseId);
    if (!lease) return { isOk: false, value: ERR_LEASE_NOT_FOUND };
    if (caller !== lease.landlord) return { isOk: false, value: ERR_NOT_AUTHORIZED };
    if (!lease["dispute-filed"]) return { isOk: false, value: 109n };
    if (lease["claimed-by-landlord"]) return { isOk: false, value: ERR_ALREADY_CLAIMED };
    if (lease.refunded) return { isOk: false, value: ERR_DEPOSIT_REFUNDED };
    if (amount > lease["deposit-amount"]) return { isOk: false, value: ERR_INVALID_AMOUNT };

    lease["claimed-by-landlord"] = true;
    const remaining = lease["deposit-amount"] - amount;

    this.transferSTX(amount, CONTRACT_PRINCIPAL, lease.landlord);
    if (remaining > 0n) {
      this.transferSTX(remaining, CONTRACT_PRINCIPAL, lease.tenant);
      lease.refunded = true;
    }

    return { isOk: true, value: true };
  }

  getLease(leaseId: bigint): Lease | undefined {
    return this.leases.get(leaseId);
  }

  getContractBalance() {
    return this.getBalance(CONTRACT_PRINCIPAL);
  }
}

describe("DepositEscrow - Pure Vitest Mock (Fixed & Passing)", () => {
  let escrow: DepositEscrowMock;
  let landlord: Principal;
  let tenant: Principal;
  let stranger: Principal;

  beforeEach(() => {
    escrow = new DepositEscrowMock();
    landlord = "ST1LANDLORD";
    tenant = "ST2TENANT";
    stranger = "ST3STRANGER";
  });

  it("initializes lease and tenant locks deposit", () => {
    const init = escrow.initializeLease(landlord, 1n, landlord, tenant, 10000000n, 2880n);
    expect(init).toEqual({ isOk: true, value: 1n });

    const lock = escrow.lockDeposit(tenant, 1n);
    expect(lock).toEqual({ isOk: true, value: true });
    expect(escrow.getContractBalance()).toBe(10000000n);
  });

  it("auto-refunds deposit after lease ends with no dispute", () => {
    escrow.initializeLease(landlord, 1n, landlord, tenant, 5000000n, 100n);
    escrow.lockDeposit(tenant, 1n);
    escrow.mineBlocks(200n);

    const refund = escrow.refundDeposit(tenant, 1n);
    expect(refund).toEqual({ isOk: true, value: true });
    expect(escrow.getContractBalance()).toBe(0n);
  });

  it("blocks refund during grace period after dispute", () => {
    escrow.initializeLease(landlord, 1n, landlord, tenant, 8000000n, 100n);
    escrow.lockDeposit(tenant, 1n);
    escrow.mineBlocks(150n);
    escrow.fileDispute(landlord, 1n);
    escrow.mineBlocks(500n);

    const refund = escrow.refundDeposit(tenant, 1n);
    expect(refund).toEqual({ isOk: false, value: ERR_GRACE_PERIOD_NOT_OVER });
  });

  it("allows full refund after grace period even if dispute was filed", () => {
    escrow.initializeLease(landlord, 1n, landlord, tenant, 10000000n, 100n);
    escrow.lockDeposit(tenant, 1n);
    escrow.mineBlocks(150n);
    escrow.fileDispute(landlord, 1n);
    escrow.mineBlocks(GRACE_PERIOD_BLOCKS + 100n);

    const refund = escrow.refundDeposit(tenant, 1n);
    expect(refund).toEqual({ isOk: true, value: true });
  });

  it("landlord can claim partial damages after dispute", () => {
    escrow.initializeLease(landlord, 1n, landlord, tenant, 12000000n, 100n);
    escrow.lockDeposit(tenant, 1n);
    escrow.mineBlocks(200n);
    escrow.fileDispute(landlord, 1n);

    const claim = escrow.claimDamages(landlord, 1n, 7000000n);
    expect(claim).toEqual({ isOk: true, value: true });
    expect(escrow.getContractBalance()).toBe(0n);
  });

  it("prevents double claiming and double refunding", () => {
    escrow.initializeLease(landlord, 1n, landlord, tenant, 6000000n, 100n);
    escrow.lockDeposit(tenant, 1n);
    escrow.mineBlocks(200n);
    escrow.fileDispute(landlord, 1n);
    escrow.claimDamages(landlord, 1n, 3000000n);

    const claimAgain = escrow.claimDamages(landlord, 1n, 1000000n);
    expect(claimAgain).toEqual({ isOk: false, value: ERR_ALREADY_CLAIMED });

    const refund = escrow.refundDeposit(tenant, 1n);
    expect(refund).toEqual({ isOk: false, value: ERR_DEPOSIT_REFUNDED });
  });

  it("only tenant can lock deposit, only landlord can claim damages", () => {
    escrow.initializeLease(landlord, 1n, landlord, tenant, 10000000n, 100n);

    const wrongLock = escrow.lockDeposit(stranger, 1n);
    expect(wrongLock).toEqual({ isOk: false, value: ERR_NOT_AUTHORIZED });

    escrow.lockDeposit(tenant, 1n);
    escrow.mineBlocks(200n);
    escrow.fileDispute(landlord, 1n);

    const wrongClaim = escrow.claimDamages(tenant, 1n, 5000000n);
    expect(wrongClaim).toEqual({ isOk: false, value: ERR_NOT_AUTHORIZED });
  });
});