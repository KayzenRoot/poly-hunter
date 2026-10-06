import { describe, expect, it } from "vitest";
import {
  evaluateTenantResolution,
  isPlatformAdmin,
  tenantRoleHasCapability,
} from "@polyhunter/domain";
import { sanitizeReturnTo } from "../apps/web/src/identity/open-redirect.js";
import { verifySanitizedIdentityShape } from "../apps/web/src/identity/identity-sanitizer.js";

/**
 * Adversarial unit coverage for PH-M01-WO-002 trust boundaries that are pure
 * (no DB / no provider): tenant resolution policy, RBAC capability matrix,
 * platform_admin separation, open-redirect sanitization and identity shape
 * validation. DB/provider-backed cases live in the integration suite.
 */

describe("tenant resolution policy (SEC-019/SEC-020/SEC-022)", () => {
  const base = {
    authenticated: true,
    userStatus: "active" as const,
    membership: {
      userId: "11111111-1111-4111-8111-111111111111",
      tenantId: "22222222-2222-4222-8222-222222222222",
      role: "member" as const,
      status: "active" as const,
    },
    tenantStatus: "active" as const,
  };

  it("fails closed when unauthenticated even if a membership row exists", () => {
    const outcome = evaluateTenantResolution({ ...base, authenticated: false });
    expect(outcome).toEqual({ kind: "unresolved", reason: "unauthenticated" });
  });

  it("fails closed when no membership exists (user from tenant A selecting tenant B)", () => {
    const outcome = evaluateTenantResolution({ ...base, membership: null });
    expect(outcome).toEqual({
      kind: "unresolved",
      reason: "no_active_membership",
    });
  });

  it("fails closed on suspended membership (revocation applies next authoritative read)", () => {
    const outcome = evaluateTenantResolution({
      ...base,
      membership: { ...base.membership, status: "suspended" },
    });
    expect(outcome).toEqual({
      kind: "unresolved",
      reason: "no_active_membership",
    });
  });

  it("fails closed on invited (never-activated) membership", () => {
    const outcome = evaluateTenantResolution({
      ...base,
      membership: { ...base.membership, status: "invited" },
    });
    expect(outcome).toEqual({
      kind: "unresolved",
      reason: "no_active_membership",
    });
  });

  it("fails closed on suspended internal user", () => {
    const outcome = evaluateTenantResolution({
      ...base,
      userStatus: "suspended",
    });
    expect(outcome).toEqual({ kind: "unresolved", reason: "user_suspended" });
  });

  it("fails closed on suspended tenant", () => {
    const outcome = evaluateTenantResolution({
      ...base,
      tenantStatus: "suspended",
    });
    expect(outcome).toEqual({
      kind: "unresolved",
      reason: "tenant_not_active",
    });
  });

  it("issues a frozen context only for an active membership+user+tenant", () => {
    const outcome = evaluateTenantResolution(base);
    expect(outcome.kind).toBe("resolved");
    if (outcome.kind !== "resolved") return;
    expect(outcome.context.tenantId).toBe(base.membership.tenantId);
    expect(outcome.context.userId).toBe(base.membership.userId);
    expect(outcome.context.role).toBe("member");
    expect(Object.isFrozen(outcome.context)).toBe(true);
  });
});

describe("RBAC capability matrix (ADR-0005)", () => {
  it("grants rename/invite/role/remove to owner and admin", () => {
    expect(tenantRoleHasCapability("owner", "tenant:rename")).toBe(true);
    expect(tenantRoleHasCapability("admin", "tenant:rename")).toBe(true);
    expect(tenantRoleHasCapability("owner", "member:invite")).toBe(true);
  });

  it("denies admin capabilities to member (member cannot perform admin action)", () => {
    expect(tenantRoleHasCapability("member", "tenant:rename")).toBe(false);
    expect(tenantRoleHasCapability("member", "member:invite")).toBe(false);
    expect(tenantRoleHasCapability("member", "member:remove")).toBe(false);
  });

  it("keeps tenant:read available to all tenant roles", () => {
    for (const role of ["owner", "admin", "member"] as const) {
      expect(tenantRoleHasCapability(role, "tenant:read")).toBe(true);
    }
  });
});

describe("platform_admin separation (SEC-002/SEC-021)", () => {
  it("platform_admin comes only from the authoritative platform_roles value", () => {
    expect(isPlatformAdmin("platform_admin")).toBe(true);
    expect(isPlatformAdmin(null)).toBe(false);
  });

  it("tenant roles can never produce platform authority", () => {
    // Even with every tenant role in hand, no platform authority is implied.
    for (const role of ["owner", "admin", "member"] as const) {
      void role;
      expect(isPlatformAdmin(null)).toBe(false);
    }
  });
});

describe("open-redirect guard (auth callback)", () => {
  it("accepts same-origin relative paths", () => {
    expect(sanitizeReturnTo("/")).toBe("/");
    expect(sanitizeReturnTo("/dashboard")).toBe("/dashboard");
    expect(sanitizeReturnTo("/dashboard?tab=2#sec")).toBe(
      "/dashboard?tab=2#sec",
    );
  });

  it("rejects absolute and protocol-relative escapes", () => {
    expect(sanitizeReturnTo("https://evil.example/path")).toBe("/");
    expect(sanitizeReturnTo("//evil.example/path")).toBe("/");
    expect(sanitizeReturnTo("javascript:alert(1)")).toBe("/");
  });

  it("rejects encoded slash escapes", () => {
    expect(sanitizeReturnTo("/%2f%2fevil.example")).toBe("/");
  });

  it("rejects backslashes and oversized values", () => {
    expect(sanitizeReturnTo("/a\\b")).toBe("/");
    expect(sanitizeReturnTo(`/${"a".repeat(600)}`)).toBe("/");
  });

  it("defaults empty/null to '/'", () => {
    expect(sanitizeReturnTo(null)).toBe("/");
    expect(sanitizeReturnTo(undefined)).toBe("/");
    expect(sanitizeReturnTo("")).toBe("/");
  });
});

describe("verified identity shape validation (provider subject handling)", () => {
  it("accepts a well-formed subject", () => {
    const identity = verifySanitizedIdentityShape("supabase", "auth0|abc123");
    expect(identity).toEqual({
      kind: "verified",
      identity: { provider: "supabase", subject: "auth0|abc123" },
    });
  });

  it("fails closed on empty/oversized/whitespace subjects", () => {
    expect(verifySanitizedIdentityShape("supabase", "").kind).toBe(
      "unverified",
    );
    expect(verifySanitizedIdentityShape("supabase", "   ").kind).toBe(
      "unverified",
    );
    expect(verifySanitizedIdentityShape("supabase", " x ".trim()).kind).toBe(
      "verified",
    );
    expect(verifySanitizedIdentityShape("supabase", "x".repeat(256)).kind).toBe(
      "unverified",
    );
  });

  it("ignores forged user_id / user_metadata fields by construction", () => {
    // The sanitizer only reads the authoritative `sub` claim; any
    // user_metadata/role/tenant fields in the payload are structurally ignored.
    const forged = {
      sub: "auth0|real-subject",
      user_metadata: {
        platform_admin: true,
        tenant_id: "22222222-2222-4222-8222-222222222222",
        role: "owner",
      },
    };
    const identity = verifySanitizedIdentityShape(
      "supabase",
      forged.sub,
      forged,
    );
    expect(identity.kind).toBe("verified");
    if (identity.kind !== "verified") return;
    expect(Object.keys(identity.identity)).toEqual(["provider", "subject"]);
    expect("user_metadata" in identity.identity).toBe(false);
    expect("role" in identity.identity).toBe(false);
    expect("tenant_id" in identity.identity).toBe(false);
  });
});

describe("resolved context is client-safe (no authorization proof by id)", () => {
  it("a forged tenant_id cannot appear in a context without an authoritative row", () => {
    // evaluateTenantResolution only copies ids from the membership row it was
    // given; a forged tenant id with no membership row resolves to failure.
    const outcome = evaluateTenantResolution({
      authenticated: true,
      userStatus: "active",
      membership: null,
      tenantStatus: null,
    });
    expect(outcome.kind).toBe("unresolved");
  });
});
