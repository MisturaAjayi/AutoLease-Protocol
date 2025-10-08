// tests/LeaseCore.test.ts

import { describe, it, expect, beforeEach } from "vitest";
import { cvToValue, stringAsciiCV, uintCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INVALID_DURATION = 101;
const ERR_INVALID_RENT = 102;
const ERR_INVALID_DEPOSIT = 103;
const ERR_INVALID_GRACE_PERIOD = 104;
const ERR_INVALID_STATE = 105;
const ERR_LEASE_NOT_FOUND = 107;
const ERR_INVALID_START_TIME = 108;
const ERR_AUTHORITY_NOT_SET = 109;
const ERR_INVALID_PENALTY_RATE = 110;
const ERR_INVALID_MAX_RENEWS = 111;
const ERR_UPDATE_NOT_ALLOWED = 112;
const ERR_INVALID_UPDATE_PARAM = 113;
const ERR_MAX_LEASES_EXCEEDED = 114;
const ERR_INVALID_LEASE_TYPE = 115;
const ERR_INVALID_TERMINATION_FEE = 116;
const ERR_INVALID_RENEWAL_THRESHOLD = 117;
const ERR_INVALID_LOCATION = 118;
const ERR_INVALID_CURRENCY = 119;
const ERR_INVALID_STATUS = 120;
const ERR_INTEGRATION_NOT_VERIFIED = 121;
const ERR_INVALID_PARTY = 122;
const ERR_LEASE_EXPIRED = 123;
const ERR_DISPUTE_ALREADY_FILED = 124;

interface Lease {
  landlord: string;
  tenant: string;
  duration: number;
  rentAmount: number;
  depositAmount: number;
  gracePeriod: number;
  startTime: number;
  state: string;
  leaseType: string;
  penaltyRate: number;
  maxRenews: number;
  terminationFee: number;
  renewalThreshold: number;
  location: string;
  currency: string;
  lastPaymentTime: number;
  endTime: number | null;
  disputeFiled: boolean;
  renewCount: number;
}

interface LeaseUpdate {
  updateDuration: number;
  updateRent: number;
  updateTimestamp: number;
  updater: string;
}

type Result<T> = { ok: true; value: T } | { ok: false; value: number };

class LeaseCoreMock {
  state: {
    nextLeaseId: number;
    maxLeases: number;
    creationFee: number;
    authorityContract: string | null;
    paymentContract: string;
    escrowContract: string;
    verifierContract: string;
    arbiterContract: string;
    leases: Map<number, Lease>;
    leasesByLocation: Map<string, number[]>;
    leaseUpdates: Map<number, LeaseUpdate>;
  } = {
    nextLeaseId: 0,
    maxLeases: 10000,
    creationFee: 500,
    authorityContract: null,
    paymentContract: "SP000000000000000000002Q6VF78",
    escrowContract: "SP000000000000000000002Q6VF78",
    verifierContract: "SP000000000000000000002Q6VF78",
    arbiterContract: "SP000000000000000000002Q6VF78",
    leases: new Map(),
    leasesByLocation: new Map(),
    leaseUpdates: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1LANDLORD";
  stxTransfers: Array<{ amount: number; from: string; to: string | null }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      nextLeaseId: 0,
      maxLeases: 10000,
      creationFee: 500,
      authorityContract: null,
      paymentContract: "SP000000000000000000002Q6VF78",
      escrowContract: "SP000000000000000000002Q6VF78",
      verifierContract: "SP000000000000000000002Q6VF78",
      arbiterContract: "SP000000000000000000002Q6VF78",
      leases: new Map(),
      leasesByLocation: new Map(),
      leaseUpdates: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1LANDLORD";
    this.stxTransfers = [];
  }

  setAuthorityContract(contractPrincipal: string): Result<boolean> {
    if (contractPrincipal === "SP000000000000000000002Q6VF78") {
      return { ok: false, value: ERR_NOT_AUTHORIZED };
    }
    if (this.state.authorityContract !== null) {
      return { ok: false, value: ERR_AUTHORITY_NOT_SET };
    }
    this.state.authorityContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setCreationFee(newFee: number): Result<boolean> {
    if (this.state.authorityContract === null) {
      return { ok: false, value: ERR_AUTHORITY_NOT_SET };
    }
    if (newFee < 0) {
      return { ok: false, value: ERR_INVALID_UPDATE_PARAM };
    }
    this.state.creationFee = newFee;
    return { ok: true, value: true };
  }

  setPaymentContract(contract: string): Result<boolean> {
    if (this.state.authorityContract === null) {
      return { ok: false, value: ERR_AUTHORITY_NOT_SET };
    }
    if (contract === "SP000000000000000000002Q6VF78") {
      return { ok: false, value: ERR_NOT_AUTHORIZED };
    }
    this.state.paymentContract = contract;
    return { ok: true, value: true };
  }

  setEscrowContract(contract: string): Result<boolean> {
    if (this.state.authorityContract === null) {
      return { ok: false, value: ERR_AUTHORITY_NOT_SET };
    }
    if (contract === "SP000000000000000000002Q6VF78") {
      return { ok: false, value: ERR_NOT_AUTHORIZED };
    }
    this.state.escrowContract = contract;
    return { ok: true, value: true };
  }

  setVerifierContract(contract: string): Result<boolean> {
    if (this.state.authorityContract === null) {
      return { ok: false, value: ERR_AUTHORITY_NOT_SET };
    }
    if (contract === "SP000000000000000000002Q6VF78") {
      return { ok: false, value: ERR_NOT_AUTHORIZED };
    }
    this.state.verifierContract = contract;
    return { ok: true, value: true };
  }

  setArbiterContract(contract: string): Result<boolean> {
    if (this.state.authorityContract === null) {
      return { ok: false, value: ERR_AUTHORITY_NOT_SET };
    }
    if (contract === "SP000000000000000000002Q6VF78") {
      return { ok: false, value: ERR_NOT_AUTHORIZED };
    }
    this.state.arbiterContract = contract;
    return { ok: true, value: true };
  }

  createLease(
    landlord: string,
    tenant: string,
    duration: number,
    rentAmount: number,
    depositAmount: number,
    gracePeriod: number,
    startTime: number,
    leaseType: string,
    penaltyRate: number,
    maxRenews: number,
    terminationFee: number,
    renewalThreshold: number,
    location: string,
    currency: string
  ): Result<number> {
    if (this.state.nextLeaseId >= this.state.maxLeases) {
      return { ok: false, value: ERR_MAX_LEASES_EXCEEDED };
    }
    if (duration <= 0 || duration > 3650) {
      return { ok: false, value: ERR_INVALID_DURATION };
    }
    if (rentAmount <= 0) {
      return { ok: false, value: ERR_INVALID_RENT };
    }
    if (depositAmount < 0) {
      return { ok: false, value: ERR_INVALID_DEPOSIT };
    }
    if (gracePeriod > 30) {
      return { ok: false, value: ERR_INVALID_GRACE_PERIOD };
    }
    if (startTime < this.blockHeight) {
      return { ok: false, value: ERR_INVALID_START_TIME };
    }
    if (!["residential", "commercial", "short-term"].includes(leaseType)) {
      return { ok: false, value: ERR_INVALID_LEASE_TYPE };
    }
    if (penaltyRate > 100) {
      return { ok: false, value: ERR_INVALID_PENALTY_RATE };
    }
    if (maxRenews > 10) {
      return { ok: false, value: ERR_INVALID_MAX_RENEWS };
    }
    if (terminationFee < 0) {
      return { ok: false, value: ERR_INVALID_TERMINATION_FEE };
    }
    if (renewalThreshold <= 0 || renewalThreshold > 100) {
      return { ok: false, value: ERR_INVALID_RENEWAL_THRESHOLD };
    }
    if (!location || location.length > 100) {
      return { ok: false, value: ERR_INVALID_LOCATION };
    }
    if (!["STX", "USD", "BTC"].includes(currency)) {
      return { ok: false, value: ERR_INVALID_CURRENCY };
    }
    if (landlord === this.caller || tenant === this.caller) {
      return { ok: false, value: ERR_INVALID_PARTY };
    }
    if (this.state.authorityContract === null) {
      return { ok: false, value: ERR_AUTHORITY_NOT_SET };
    }

    this.stxTransfers.push({ amount: this.state.creationFee, from: this.caller, to: this.state.authorityContract });

    const id = this.state.nextLeaseId;
    const lease: Lease = {
      landlord,
      tenant,
      duration,
      rentAmount,
      depositAmount,
      gracePeriod,
      startTime,
      state: "pending",
      leaseType,
      penaltyRate,
      maxRenews,
      terminationFee,
      renewalThreshold,
      location,
      currency,
      lastPaymentTime: 0,
      endTime: null,
      disputeFiled: false,
      renewCount: 0,
    };
    this.state.leases.set(id, lease);
    const locLeases = this.state.leasesByLocation.get(location) || [];
    locLeases.push(id);
    this.state.leasesByLocation.set(location, locLeases);
    this.state.nextLeaseId++;
    return { ok: true, value: id };
  }

  getLease(id: number): Lease | null {
    return this.state.leases.get(id) || null;
  }

  activateLease(leaseId: number): Result<boolean> {
    const lease = this.state.leases.get(leaseId);
    if (!lease) {
      return { ok: false, value: ERR_LEASE_NOT_FOUND };
    }
    if (lease.state !== "pending") {
      return { ok: false, value: ERR_INVALID_STATE };
    }
    if (this.caller !== lease.tenant) {
      return { ok: false, value: ERR_NOT_AUTHORIZED };
    }
    if (this.blockHeight < lease.startTime) {
      return { ok: false, value: ERR_INVALID_START_TIME };
    }
    lease.state = "active";
    lease.lastPaymentTime = this.blockHeight;
    lease.endTime = lease.startTime + lease.duration;
    this.state.leases.set(leaseId, lease);
    return { ok: true, value: true };
  }

  endLease(leaseId: number): Result<boolean> {
    const lease = this.state.leases.get(leaseId);
    if (!lease) {
      return { ok: false, value: ERR_LEASE_NOT_FOUND };
    }
    if (lease.state !== "active") {
      return { ok: false, value: ERR_INVALID_STATE };
    }
    if (this.caller !== lease.landlord && this.caller !== lease.tenant) {
      return { ok: false, value: ERR_NOT_AUTHORIZED };
    }
    const calculatedEnd = lease.startTime + lease.duration;
    if (this.blockHeight < calculatedEnd) {
      return { ok: false, value: ERR_LEASE_EXPIRED };
    }
    lease.state = "ended";
    lease.endTime = this.blockHeight;
    this.state.leases.set(leaseId, lease);
    return { ok: true, value: true };
  }

  fileDispute(leaseId: number): Result<boolean> {
    const lease = this.state.leases.get(leaseId);
    if (!lease) {
      return { ok: false, value: ERR_LEASE_NOT_FOUND };
    }
    if (lease.state !== "ended") {
      return { ok: false, value: ERR_INVALID_STATE };
    }
    if (this.caller !== lease.landlord) {
      return { ok: false, value: ERR_NOT_AUTHORIZED };
    }
    if (lease.disputeFiled) {
      return { ok: false, value: ERR_DISPUTE_ALREADY_FILED };
    }
    if (lease.endTime === null) {
      return { ok: false, value: ERR_INVALID_STATE };
    }
    const graceEnd = lease.endTime + lease.gracePeriod;
    if (this.blockHeight > graceEnd) {
      return { ok: false, value: ERR_LEASE_EXPIRED };
    }
    lease.state = "disputed";
    lease.disputeFiled = true;
    this.state.leases.set(leaseId, lease);
    return { ok: true, value: true };
  }

  resolveDispute(leaseId: number, resolvedState: string): Result<boolean> {
    const lease = this.state.leases.get(leaseId);
    if (!lease) {
      return { ok: false, value: ERR_LEASE_NOT_FOUND };
    }
    if (lease.state !== "disputed") {
      return { ok: false, value: ERR_INVALID_STATE };
    }
    if (this.caller !== this.state.arbiterContract) {
      return { ok: false, value: ERR_NOT_AUTHORIZED };
    }
    if (!["resolved-refund", "resolved-deduct"].includes(resolvedState)) {
      return { ok: false, value: ERR_INVALID_STATUS };
    }
    lease.state = resolvedState;
    this.state.leases.set(leaseId, lease);
    return { ok: true, value: true };
  }

  renewLease(leaseId: number): Result<boolean> {
    const lease = this.state.leases.get(leaseId);
    if (!lease) {
      return { ok: false, value: ERR_LEASE_NOT_FOUND };
    }
    if (lease.state !== "active") {
      return { ok: false, value: ERR_INVALID_STATE };
    }
    if (this.caller !== lease.tenant) {
      return { ok: false, value: ERR_NOT_AUTHORIZED };
    }
    if (lease.renewCount >= lease.maxRenews) {
      return { ok: false, value: ERR_INVALID_MAX_RENEWS };
    }
    if (lease.endTime === null) {
      return { ok: false, value: ERR_INVALID_STATE };
    }
    if (lease.endTime - this.blockHeight > lease.renewalThreshold) {
      return { ok: false, value: ERR_INVALID_RENEWAL_THRESHOLD };
    }
    lease.duration += lease.duration;
    lease.endTime = lease.endTime + lease.duration;
    lease.renewCount += 1;
    this.state.leases.set(leaseId, lease);
    return { ok: true, value: true };
  }

  updateLease(leaseId: number, newDuration: number, newRent: number): Result<boolean> {
    const lease = this.state.leases.get(leaseId);
    if (!lease) {
      return { ok: false, value: ERR_LEASE_NOT_FOUND };
    }
    if (lease.state !== "pending") {
      return { ok: false, value: ERR_UPDATE_NOT_ALLOWED };
    }
    if (this.caller !== lease.landlord) {
      return { ok: false, value: ERR_NOT_AUTHORIZED };
    }
    if (newDuration <= 0 || newDuration > 3650) {
      return { ok: false, value: ERR_INVALID_DURATION };
    }
    if (newRent <= 0) {
      return { ok: false, value: ERR_INVALID_RENT };
    }
    lease.duration = newDuration;
    lease.rentAmount = newRent;
    this.state.leases.set(leaseId, lease);
    this.state.leaseUpdates.set(leaseId, {
      updateDuration: newDuration,
      updateRent: newRent,
      updateTimestamp: this.blockHeight,
      updater: this.caller,
    });
    return { ok: true, value: true };
  }

  recordPayment(leaseId: number, paymentTime: number): Result<boolean> {
    const lease = this.state.leases.get(leaseId);
    if (!lease) {
      return { ok: false, value: ERR_LEASE_NOT_FOUND };
    }
    if (lease.state !== "active") {
      return { ok: false, value: ERR_INVALID_STATE };
    }
    if (this.caller !== this.state.paymentContract) {
      return { ok: false, value: ERR_NOT_AUTHORIZED };
    }
    if (paymentTime <= lease.lastPaymentTime) {
      return { ok: false, value: ERR_INVALID_START_TIME };
    }
    lease.lastPaymentTime = paymentTime;
    this.state.leases.set(leaseId, lease);
    return { ok: true, value: true };
  }

  getLeaseCount(): Result<number> {
    return { ok: true, value: this.state.nextLeaseId };
  }

  getLeasesByLocation(loc: string): Result<number[]> {
    return { ok: true, value: this.state.leasesByLocation.get(loc) || [] };
  }

  integrateWithEscrow(leaseId: number): Result<boolean> {
    const lease = this.state.leases.get(leaseId);
    if (!lease) {
      return { ok: false, value: ERR_LEASE_NOT_FOUND };
    }
    if (this.caller !== this.state.escrowContract) {
      return { ok: false, value: ERR_INTEGRATION_NOT_VERIFIED };
    }
    return { ok: true, value: true };
  }

  integrateWithVerifier(leaseId: number): Result<boolean> {
    const lease = this.state.leases.get(leaseId);
    if (!lease) {
      return { ok: false, value: ERR_LEASE_NOT_FOUND };
    }
    if (this.caller !== this.state.verifierContract) {
      return { ok: false, value: ERR_INTEGRATION_NOT_VERIFIED };
    }
    return { ok: true, value: true };
  }
}

describe("LeaseCore", () => {
  let contract: LeaseCoreMock;

  beforeEach(() => {
    contract = new LeaseCoreMock();
    contract.reset();
  });

  it("creates a lease successfully", () => {
    contract.setAuthorityContract("ST2AUTH");
    const result = contract.createLease(
      "ST3LANDLORD",
      "ST4TENANT",
      365,
      1000,
      2000,
      7,
      10,
      "residential",
      5,
      2,
      500,
      30,
      "CityA",
      "STX"
    );
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);

    const lease = contract.getLease(0);
    expect(lease?.landlord).toBe("ST3LANDLORD");
    expect(lease?.tenant).toBe("ST4TENANT");
    expect(lease?.duration).toBe(365);
    expect(lease?.rentAmount).toBe(1000);
    expect(lease?.depositAmount).toBe(2000);
    expect(lease?.gracePeriod).toBe(7);
    expect(lease?.startTime).toBe(10);
    expect(lease?.state).toBe("pending");
    expect(lease?.leaseType).toBe("residential");
    expect(lease?.penaltyRate).toBe(5);
    expect(lease?.maxRenews).toBe(2);
    expect(lease?.terminationFee).toBe(500);
    expect(lease?.renewalThreshold).toBe(30);
    expect(lease?.location).toBe("CityA");
    expect(lease?.currency).toBe("STX");
    expect(lease?.lastPaymentTime).toBe(0);
    expect(lease?.endTime).toBe(null);
    expect(lease?.disputeFiled).toBe(false);
    expect(contract.stxTransfers).toEqual([{ amount: 500, from: "ST1LANDLORD", to: "ST2AUTH" }]);
  });

  it("rejects lease creation without authority", () => {
    const result = contract.createLease(
      "ST3LANDLORD",
      "ST4TENANT",
      365,
      1000,
      2000,
      7,
      10,
      "residential",
      5,
      2,
      500,
      30,
      "CityA",
      "STX"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_AUTHORITY_NOT_SET);
  });

  it("rejects invalid duration", () => {
    contract.setAuthorityContract("ST2AUTH");
    const result = contract.createLease(
      "ST3LANDLORD",
      "ST4TENANT",
      0,
      1000,
      2000,
      7,
      10,
      "residential",
      5,
      2,
      500,
      30,
      "CityA",
      "STX"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_DURATION);
  });

  it("activates lease successfully", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.createLease(
      "ST3LANDLORD",
      "ST4TENANT",
      365,
      1000,
      2000,
      7,
      10,
      "residential",
      5,
      2,
      500,
      30,
      "CityA",
      "STX"
    );
    contract.caller = "ST4TENANT";
    contract.blockHeight = 10;
    const result = contract.activateLease(0);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const lease = contract.getLease(0);
    expect(lease?.state).toBe("active");
    expect(lease?.lastPaymentTime).toBe(10);
  });

  it("rejects activation by non-tenant", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.createLease(
      "ST3LANDLORD",
      "ST4TENANT",
      365,
      1000,
      2000,
      7,
      10,
      "residential",
      5,
      2,
      500,
      30,
      "CityA",
      "STX"
    );
    contract.blockHeight = 10;
    const result = contract.activateLease(0);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("ends lease successfully", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.createLease(
      "ST3LANDLORD",
      "ST4TENANT",
      365,
      1000,
      2000,
      7,
      10,
      "residential",
      5,
      2,
      500,
      30,
      "CityA",
      "STX"
    );
    contract.caller = "ST4TENANT";
    contract.blockHeight = 10;
    contract.activateLease(0);
    contract.caller = "ST3LANDLORD";
    contract.blockHeight = 375;
    const result = contract.endLease(0);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const lease = contract.getLease(0);
    expect(lease?.state).toBe("ended");
    expect(lease?.endTime).toBe(375);
  });

  it("rejects end lease before expiration", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.createLease(
      "ST3LANDLORD",
      "ST4TENANT",
      365,
      1000,
      2000,
      7,
      10,
      "residential",
      5,
      2,
      500,
      30,
      "CityA",
      "STX"
    );
    contract.caller = "ST4TENANT";
    contract.blockHeight = 10;
    contract.activateLease(0);
    contract.blockHeight = 300;
    const result = contract.endLease(0);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_LEASE_EXPIRED);
  });

  it("files dispute successfully", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.createLease(
      "ST3LANDLORD",
      "ST4TENANT",
      365,
      1000,
      2000,
      7,
      10,
      "residential",
      5,
      2,
      500,
      30,
      "CityA",
      "STX"
    );
    contract.caller = "ST4TENANT";
    contract.blockHeight = 10;
    contract.activateLease(0);
    contract.caller = "ST3LANDLORD";
    contract.blockHeight = 375;
    contract.endLease(0);
    contract.blockHeight = 380;
    const result = contract.fileDispute(0);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const lease = contract.getLease(0);
    expect(lease?.state).toBe("disputed");
    expect(lease?.disputeFiled).toBe(true);
  });

  it("rejects dispute after grace period", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.createLease(
      "ST3LANDLORD",
      "ST4TENANT",
      365,
      1000,
      2000,
      7,
      10,
      "residential",
      5,
      2,
      500,
      30,
      "CityA",
      "STX"
    );
    contract.caller = "ST4TENANT";
    contract.blockHeight = 10;
    contract.activateLease(0);
    contract.caller = "ST3LANDLORD";
    contract.blockHeight = 375;
    contract.endLease(0);
    contract.blockHeight = 383;
    const result = contract.fileDispute(0);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_LEASE_EXPIRED);
  });

  it("resolves dispute successfully", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.createLease(
      "ST3LANDLORD",
      "ST4TENANT",
      365,
      1000,
      2000,
      7,
      10,
      "residential",
      5,
      2,
      500,
      30,
      "CityA",
      "STX"
    );
    contract.caller = "ST4TENANT";
    contract.blockHeight = 10;
    contract.activateLease(0);
    contract.caller = "ST3LANDLORD";
    contract.blockHeight = 375;
    contract.endLease(0);
    contract.blockHeight = 380;
    contract.fileDispute(0);
    contract.caller = "SP000000000000000000002Q6VF78";
    const result = contract.resolveDispute(0, "resolved-refund");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const lease = contract.getLease(0);
    expect(lease?.state).toBe("resolved-refund");
  });

  it("rejects resolve by non-arbiter", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.createLease(
      "ST3LANDLORD",
      "ST4TENANT",
      365,
      1000,
      2000,
      7,
      10,
      "residential",
      5,
      2,
      500,
      30,
      "CityA",
      "STX"
    );
    contract.caller = "ST4TENANT";
    contract.blockHeight = 10;
    contract.activateLease(0);
    contract.caller = "ST3LANDLORD";
    contract.blockHeight = 375;
    contract.endLease(0);
    contract.blockHeight = 380;
    contract.fileDispute(0);
    const result = contract.resolveDispute(0, "resolved-refund");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("renews lease successfully", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.createLease(
      "ST3LANDLORD",
      "ST4TENANT",
      365,
      1000,
      2000,
      7,
      10,
      "residential",
      5,
      2,
      500,
      30,
      "CityA",
      "STX"
    );
    contract.caller = "ST4TENANT";
    contract.blockHeight = 10;
    contract.activateLease(0);
    contract.blockHeight = 350;
    const result = contract.renewLease(0);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const lease = contract.getLease(0);
    expect(lease?.duration).toBe(730);
    expect(lease?.endTime).toBe(1105);
    expect(lease?.renewCount).toBe(1);
  });

  it("rejects renew beyond max", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.createLease(
      "ST3LANDLORD",
      "ST4TENANT",
      365,
      1000,
      2000,
      7,
      10,
      "residential",
      5,
      1,
      500,
      30,
      "CityA",
      "STX"
    );
    contract.caller = "ST4TENANT";
    contract.blockHeight = 10;
    contract.activateLease(0);
    contract.blockHeight = 350;
    contract.renewLease(0);
    const result = contract.renewLease(0);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_MAX_RENEWS);
  });

  it("updates lease successfully", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.createLease(
      "ST3LANDLORD",
      "ST4TENANT",
      365,
      1000,
      2000,
      7,
      10,
      "residential",
      5,
      2,
      500,
      30,
      "CityA",
      "STX"
    );
    contract.caller = "ST3LANDLORD";
    const result = contract.updateLease(0, 730, 2000);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const lease = contract.getLease(0);
    expect(lease?.duration).toBe(730);
    expect(lease?.rentAmount).toBe(2000);
    const update = contract.state.leaseUpdates.get(0);
    expect(update?.updateDuration).toBe(730);
    expect(update?.updateRent).toBe(2000);
    expect(update?.updateTimestamp).toBe(0);
    expect(update?.updater).toBe("ST3LANDLORD");
  });

  it("rejects update after activation", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.createLease(
      "ST3LANDLORD",
      "ST4TENANT",
      365,
      1000,
      2000,
      7,
      10,
      "residential",
      5,
      2,
      500,
      30,
      "CityA",
      "STX"
    );
    contract.caller = "ST4TENANT";
    contract.blockHeight = 10;
    contract.activateLease(0);
    contract.caller = "ST3LANDLORD";
    const result = contract.updateLease(0, 730, 2000);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_UPDATE_NOT_ALLOWED);
  });

  it("records payment successfully", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.createLease(
      "ST3LANDLORD",
      "ST4TENANT",
      365,
      1000,
      2000,
      7,
      10,
      "residential",
      5,
      2,
      500,
      30,
      "CityA",
      "STX"
    );
    contract.caller = "ST4TENANT";
    contract.blockHeight = 10;
    contract.activateLease(0);
    contract.caller = "SP000000000000000000002Q6VF78";
    const result = contract.recordPayment(0, 40);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const lease = contract.getLease(0);
    expect(lease?.lastPaymentTime).toBe(40);
  });

  it("rejects payment from non-payment contract", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.createLease(
      "ST3LANDLORD",
      "ST4TENANT",
      365,
      1000,
      2000,
      7,
      10,
      "residential",
      5,
      2,
      500,
      30,
      "CityA",
      "STX"
    );
    contract.caller = "ST4TENANT";
    contract.blockHeight = 10;
    contract.activateLease(0);
    const result = contract.recordPayment(0, 40);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("gets lease count correctly", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.createLease(
      "ST3LANDLORD",
      "ST4TENANT",
      365,
      1000,
      2000,
      7,
      10,
      "residential",
      5,
      2,
      500,
      30,
      "CityA",
      "STX"
    );
    contract.createLease(
      "ST5LANDLORD",
      "ST6TENANT",
      180,
      500,
      1000,
      5,
      20,
      "commercial",
      10,
      1,
      250,
      15,
      "CityB",
      "USD"
    );
    const result = contract.getLeaseCount();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(2);
  });

  it("gets leases by location correctly", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.createLease(
      "ST3LANDLORD",
      "ST4TENANT",
      365,
      1000,
      2000,
      7,
      10,
      "residential",
      5,
      2,
      500,
      30,
      "CityA",
      "STX"
    );
    contract.createLease(
      "ST5LANDLORD",
      "ST6TENANT",
      180,
      500,
      1000,
      5,
      20,
      "commercial",
      10,
      1,
      250,
      15,
      "CityA",
      "USD"
    );
    const result = contract.getLeasesByLocation("CityA");
    expect(result.ok).toBe(true);
    expect(result.value).toEqual([0, 1]);
  });

  it("integrates with escrow successfully", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.createLease(
      "ST3LANDLORD",
      "ST4TENANT",
      365,
      1000,
      2000,
      7,
      10,
      "residential",
      5,
      2,
      500,
      30,
      "CityA",
      "STX"
    );
    contract.caller = "SP000000000000000000002Q6VF78";
    const result = contract.integrateWithEscrow(0);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
  });

  it("rejects escrow integration from wrong caller", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.createLease(
      "ST3LANDLORD",
      "ST4TENANT",
      365,
      1000,
      2000,
      7,
      10,
      "residential",
      5,
      2,
      500,
      30,
      "CityA",
      "STX"
    );
    const result = contract.integrateWithEscrow(0);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INTEGRATION_NOT_VERIFIED);
  });

  it("integrates with verifier successfully", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.createLease(
      "ST3LANDLORD",
      "ST4TENANT",
      365,
      1000,
      2000,
      7,
      10,
      "residential",
      5,
      2,
      500,
      30,
      "CityA",
      "STX"
    );
    contract.caller = "SP000000000000000000002Q6VF78";
    const result = contract.integrateWithVerifier(0);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
  });

  it("rejects verifier integration from wrong caller", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.createLease(
      "ST3LANDLORD",
      "ST4TENANT",
      365,
      1000,
      2000,
      7,
      10,
      "residential",
      5,
      2,
      500,
      30,
      "CityA",
      "STX"
    );
    const result = contract.integrateWithVerifier(0);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INTEGRATION_NOT_VERIFIED);
  });

  it("sets creation fee successfully", () => {
    contract.setAuthorityContract("ST2AUTH");
    const result = contract.setCreationFee(1000);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.creationFee).toBe(1000);
  });

  it("rejects negative creation fee", () => {
    contract.setAuthorityContract("ST2AUTH");
    const result = contract.setCreationFee(-100);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_UPDATE_PARAM);
  });

  it("parses Clarity values", () => {
    const locCV = stringAsciiCV("CityA");
    expect(cvToValue(locCV)).toBe("CityA");
    const durCV = uintCV(365);
    expect(cvToValue(durCV)).toBe(BigInt(365));
  });
});