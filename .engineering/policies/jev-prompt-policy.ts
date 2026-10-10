export const JEV_SCREEN_OPTIONS = {
  review_at: 0.25,
  block_at: 0.99,
} as const;

export const JEV_INSTRUCTION_BLOCK_THRESHOLD = JEV_SCREEN_OPTIONS.block_at;

export type JevInputProvenance =
  | "TRUSTED_OPERATOR_INPUT"
  | "UNTRUSTED_EXTERNAL_CONTENT";

export type IndependentSecurityFinding =
  | "SECRET_EXPOSURE"
  | "CREDENTIAL_EXTRACTION"
  | "DESTRUCTIVE_GIT_OPERATION"
  | "PRIVATE_KEY_SIGNING"
  | "UNAUTHORIZED_TRADING"
  | "UNRESOLVED_HIGH_CRITICAL"
  | "IRREVERSIBLE_OPERATION";

export type JevPromptDisposition =
  | "CONTINUE"
  | "WARN_CONTINUE"
  | "SECURITY_EVALUATION"
  | "BLOCK";

export interface JevPromptScreenInput {
  injectionProbability: number;
  provenance: JevInputProvenance;
  independentSecurityFindings?: readonly IndependentSecurityFinding[];
}

/**
 * Reference policy for interpreting a Jev screen result.
 * JEV scores never replace independent security and governance gates.
 */
export function evaluateJevPromptScreen(
  input: JevPromptScreenInput,
): JevPromptDisposition {
  if ((input.independentSecurityFindings?.length ?? 0) > 0) return "BLOCK";

  if (input.provenance === "TRUSTED_OPERATOR_INPUT") return "CONTINUE";

  if (
    !Number.isFinite(input.injectionProbability) ||
    input.injectionProbability < 0 ||
    input.injectionProbability > 1
  ) {
    return "SECURITY_EVALUATION";
  }

  return input.injectionProbability >= JEV_INSTRUCTION_BLOCK_THRESHOLD
    ? "SECURITY_EVALUATION"
    : "WARN_CONTINUE";
}
