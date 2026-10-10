import { describe, expect, it } from "vitest";
import {
  type AdminHealthDTO,
  type BookStaleness,
  disabledKillSwitchCommand,
  type KillSwitchCommand,
  type RiskDecision,
  riskDecisionReasonCodes,
  type UserDashboardDTO,
  waveAContractVersion,
} from "../packages/contracts/src/index.ts";

const disabledCommand: KillSwitchCommand = disabledKillSwitchCommand;

const freshBook: BookStaleness = {
  state: "fresh",
  observedAtUnixMs: 1_000,
  evaluatedAtUnixMs: 1_001,
  maxAgeMs: 1_000,
};
const unknownBook: BookStaleness = {
  state: "unknown",
  observedAtUnixMs: null,
  evaluatedAtUnixMs: 1_001,
  maxAgeMs: 1_000,
};
const riskDenial: RiskDecision = {
  contractVersion: waveAContractVersion,
  outcome: "deny",
  scope: "simulation_only",
  proposalId: "proposal-fixture",
  evaluatedAtUnixMs: 1_001,
  reasonCodes: ["incomplete_exposure"],
};

// @ts-expect-error missing observation cannot be represented as fresh
const invalidFreshBook: BookStaleness = {
  state: "fresh",
  observedAtUnixMs: null,
  evaluatedAtUnixMs: 1_001,
  maxAgeMs: 1_000,
};

// @ts-expect-error missing observation cannot be represented as stale
const invalidStaleBook: BookStaleness = {
  state: "stale",
  observedAtUnixMs: null,
  evaluatedAtUnixMs: 1_001,
  maxAgeMs: 1_000,
};

const invalidRiskCode: RiskDecision = {
  ...riskDenial,
  // @ts-expect-error reason codes are a closed union, not arbitrary strings
  reasonCodes: ["free_form"],
};

const disabledDashboard = {
  contractVersion: waveAContractVersion,
  availability: "disabled",
  mode: "live_disabled",
  asOfUnixMs: null,
  sections: [
    { section: "markets", state: "disabled", itemCount: null },
    { section: "orders", state: "disabled", itemCount: null },
    { section: "trades", state: "disabled", itemCount: null },
    { section: "pnl", state: "disabled", itemCount: null },
    { section: "risk", state: "disabled", itemCount: null },
    { section: "settings", state: "disabled", itemCount: null },
  ],
  liveTradingAuthorized: false,
} satisfies UserDashboardDTO;

const disabledAdmin: AdminHealthDTO = {
  contractVersion: waveAContractVersion,
  availability: "disabled",
  checkedAtUnixMs: null,
  sections: [
    { section: "tenants", state: "disabled", itemCount: null },
    { section: "health", state: "disabled", itemCount: null },
    { section: "exposure", state: "disabled", itemCount: null },
    { section: "audit", state: "disabled", itemCount: null },
    { section: "kill_switch", state: "disabled", itemCount: null },
  ],
  killSwitch: disabledCommand,
};

describe("Wave A contracts", () => {
  it("exports version 1 with no-op kill-switch and disabled dashboard states", () => {
    expect(waveAContractVersion).toBe(1);
    expect(freshBook.state).toBe("fresh");
    expect(unknownBook.state).toBe("unknown");
    expect(riskDecisionReasonCodes).toContain(riskDenial.reasonCodes[0]);
    expect(riskDecisionReasonCodes).toContain("within_limits");
    expect(invalidFreshBook.state).toBe("fresh");
    expect(invalidStaleBook.state).toBe("stale");
    expect(invalidRiskCode.reasonCodes).toEqual(["free_form"]);
    expect(disabledCommand).toEqual({
      contractVersion: 1,
      availability: "disabled",
      operation: "NO_OP",
      canExecute: false,
    });
    expect(disabledDashboard.liveTradingAuthorized).toBe(false);
    expect(
      disabledAdmin.sections.every((section) => section.state === "disabled"),
    ).toBe(true);
  });
});
