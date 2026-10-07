import { describe, expect, it } from "vitest";
import {
  evaluateJevPromptScreen,
  JEV_SCREEN_OPTIONS,
  type IndependentSecurityFinding,
} from "../.engineering/policies/jev-prompt-policy.ts";

describe("JEV prompt policy provenance and independent gates", () => {
  it("sets the MCP block threshold explicitly instead of using its 0.75 default", () => {
    expect(JEV_SCREEN_OPTIONS.block_at).toBe(0.99);
  });

  it.each([
    { source: "operator prompt", probability: 0.8 },
    { source: "operator attachment", probability: 0.92 },
    { source: "operator Work Order", probability: 0.98 },
    { source: "operator-designated GitHub review", probability: 0.999 },
  ])(
    "continues trusted $source at probability $probability",
    ({ probability }) => {
      expect(
        evaluateJevPromptScreen({
          injectionProbability: probability,
          provenance: "TRUSTED_OPERATOR_INPUT",
        }),
      ).toBe("CONTINUE");
    },
  );

  it("warns and continues for untrusted external content below 0.99", () => {
    expect(
      evaluateJevPromptScreen({
        injectionProbability: 0.98,
        provenance: "UNTRUSTED_EXTERNAL_CONTENT",
      }),
    ).toBe("WARN_CONTINUE");
  });

  it("routes an untrusted external score at 0.99 to provenance/security evaluation", () => {
    expect(
      evaluateJevPromptScreen({
        injectionProbability: 0.99,
        provenance: "UNTRUSTED_EXTERNAL_CONTENT",
      }),
    ).toBe("SECURITY_EVALUATION");
  });

  it.each([
    "SECRET_EXPOSURE",
    "CREDENTIAL_EXTRACTION",
    "DESTRUCTIVE_GIT_OPERATION",
    "PRIVATE_KEY_SIGNING",
    "UNAUTHORIZED_TRADING",
    "UNRESOLVED_HIGH_CRITICAL",
    "IRREVERSIBLE_OPERATION",
  ] as const)("preserves an independent blocker: %s", (finding) => {
    const independentFinding: IndependentSecurityFinding = finding;
    expect(
      evaluateJevPromptScreen({
        injectionProbability: 0.1,
        provenance: "TRUSTED_OPERATOR_INPUT",
        independentSecurityFindings: [independentFinding],
      }),
    ).toBe("BLOCK");
  });
});
