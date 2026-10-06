import {
  check,
  customType,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Envelope constraint constants, mirrored from `@polyhunter/domain`.
 *
 * They are written out as literals rather than imported because drizzle-kit
 * loads this schema with its own module loader, which does not evaluate
 * cross-workspace imports — an imported constant silently renders as `undefined`
 * and would produce a CHECK with an empty regex or a `NULL` length. The WO-003
 * suite asserts each literal equals its domain counterpart, so the duplication
 * cannot drift apart unnoticed.
 */
const ENCRYPTED_SECRET_PURPOSE_MAX_LENGTH = 64;
const ENCRYPTED_SECRET_PURPOSE_PATTERN = "^[a-z][a-z0-9]*([._-][a-z0-9]+)*$";
const ENCRYPTED_SECRET_KEY_VERSION_PATTERN = "^[a-z0-9][a-z0-9_-]{0,31}$";
const ENCRYPTED_SECRET_NONCE_BYTES = 12;
const ENCRYPTED_SECRET_AUTH_TAG_BYTES = 16;

export const tenantStatus = pgEnum("tenant_status", ["active", "suspended"]);
export const userStatus = pgEnum("user_status", ["active", "suspended"]);
export const tenantRole = pgEnum("tenant_role", ["owner", "admin", "member"]);
export const membershipStatus = pgEnum("membership_status", [
  "invited",
  "active",
  "suspended",
]);

export const tenants = pgTable(
  "tenants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    slug: varchar("slug", { length: 63 }).notNull(),
    status: tenantStatus("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("tenants_slug_unique").on(table.slug),
    check("tenants_name_not_blank", sql`length(trim(${table.name})) > 0`),
    check(
      "tenants_slug_canonical",
      sql`${table.slug} = lower(${table.slug}) AND ${table.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`,
    ),
  ],
);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  status: userStatus("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const identityLinks = pgTable(
  "identity_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
    provider: varchar("provider", { length: 32 }).notNull(),
    subject: varchar("subject", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("identity_links_provider_subject_unique").on(
      table.provider,
      table.subject,
    ),
    check(
      "identity_links_provider_canonical",
      sql`${table.provider} ~ '^[a-z][a-z0-9_-]{1,31}$'`,
    ),
    check(
      "identity_links_subject_not_blank",
      sql`length(trim(${table.subject})) > 0`,
    ),
  ],
);

export const tenantMemberships = pgTable(
  "tenant_memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
    role: tenantRole("role").notNull(),
    status: membershipStatus("status").notNull().default("invited"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("tenant_memberships_tenant_user_unique").on(
      table.tenantId,
      table.userId,
    ),
  ],
);

export const platformRoleEnum = pgEnum("platform_role", ["platform_admin"]);

export const platformRoles = pgTable(
  "platform_roles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
    role: platformRoleEnum("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("platform_roles_user_role_unique").on(table.userId, table.role),
  ],
);

/**
 * `bytea` column. Declared locally because the envelope is raw binary: the
 * application layer never hex/base64-encodes an envelope component, so a
 * textual column type could only add an unvalidated representation to leak.
 */
const bytea = customType<{ data: Buffer }>({
  dataType: () => "bytea",
});

/**
 * PH-M01-WO-003 — `encrypted_secrets`.
 *
 * One row is one tenant secret envelope. The table stores ONLY envelope
 * material plus non-sensitive routing metadata; plaintext is never a column
 * and never was (SEC-004).
 *
 * Constraint rationale:
 * - `tenant_id` carries an explicit FK with CASCADE delete/update behaviour, so
 *   a tenant-owned secret cannot outlive its tenant and cannot be re-pointed at
 *   a different tenant by an UPDATE.
 * - `purpose` / `key_version` are constrained with the SAME canonical pattern
 *   the TypeScript validators use, so a value that could never be produced by
 *   the application also cannot be written directly into the column. They are
 *   bound into the AAD, so their canonicality is a cryptographic requirement,
 *   not cosmetic.
 * - `octet_length` checks pin the envelope to the protocol's exact sizes
 *   (12-byte nonce, 16-byte tag). A row that does not match is not a valid
 *   envelope and must be impossible to persist, not merely rejected on read.
 * - `UNIQUE (key_version, nonce)` is the second, database-enforced barrier
 *   against GCM nonce reuse under one key: even a caller that bypassed the
 *   application retry logic cannot persist a repeated `(key, nonce)` pair.
 */
export const encryptedSecrets = pgTable(
  "encrypted_secrets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    purpose: varchar("purpose", {
      length: ENCRYPTED_SECRET_PURPOSE_MAX_LENGTH,
    }).notNull(),
    ciphertext: bytea("ciphertext").notNull(),
    nonce: bytea("nonce").notNull(),
    authTag: bytea("auth_tag").notNull(),
    keyVersion: varchar("key_version", { length: 32 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    rotatedAt: timestamp("rotated_at", { withTimezone: true }),
  },
  (table) => [
    // Second barrier against GCM nonce reuse under a single key version.
    uniqueIndex("encrypted_secrets_key_version_nonce_unique").on(
      table.keyVersion,
      table.nonce,
    ),
    // `sql.raw` is required for the CHECK bodies: a plain interpolated value
    // becomes a bind parameter ($1), which is legal in DML but not in a
    // constraint definition and would store the literal text '$1'.
    check(
      "encrypted_secrets_purpose_canonical",
      sql`${table.purpose} ~ ${sql.raw(`'${ENCRYPTED_SECRET_PURPOSE_PATTERN}'`)} AND length(${table.purpose}) >= 2`,
    ),
    check(
      "encrypted_secrets_key_version_canonical",
      sql`${table.keyVersion} ~ ${sql.raw(`'${ENCRYPTED_SECRET_KEY_VERSION_PATTERN}'`)}`,
    ),
    check(
      "encrypted_secrets_nonce_length",
      sql`octet_length(${table.nonce}) = ${sql.raw(String(ENCRYPTED_SECRET_NONCE_BYTES))}`,
    ),
    check(
      "encrypted_secrets_auth_tag_length",
      sql`octet_length(${table.authTag}) = ${sql.raw(String(ENCRYPTED_SECRET_AUTH_TAG_BYTES))}`,
    ),
    check(
      "encrypted_secrets_ciphertext_not_empty",
      sql`octet_length(${table.ciphertext}) > 0`,
    ),
  ],
);
