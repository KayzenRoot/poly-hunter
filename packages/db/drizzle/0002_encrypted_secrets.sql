CREATE TABLE "encrypted_secrets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"purpose" varchar(64) NOT NULL,
	"ciphertext" "bytea" NOT NULL,
	"nonce" "bytea" NOT NULL,
	"auth_tag" "bytea" NOT NULL,
	"key_version" varchar(32) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rotated_at" timestamp with time zone,
	CONSTRAINT "encrypted_secrets_purpose_canonical" CHECK ("encrypted_secrets"."purpose" ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$' AND length("encrypted_secrets"."purpose") >= 2),
	CONSTRAINT "encrypted_secrets_key_version_canonical" CHECK ("encrypted_secrets"."key_version" ~ '^[a-z0-9][a-z0-9_-]{0,31}$'),
	CONSTRAINT "encrypted_secrets_nonce_length" CHECK (octet_length("encrypted_secrets"."nonce") = 12),
	CONSTRAINT "encrypted_secrets_auth_tag_length" CHECK (octet_length("encrypted_secrets"."auth_tag") = 16),
	CONSTRAINT "encrypted_secrets_ciphertext_not_empty" CHECK (octet_length("encrypted_secrets"."ciphertext") > 0)
);
--> statement-breakpoint
ALTER TABLE "encrypted_secrets" ADD CONSTRAINT "encrypted_secrets_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "encrypted_secrets_key_version_nonce_unique" ON "encrypted_secrets" USING btree ("key_version","nonce");