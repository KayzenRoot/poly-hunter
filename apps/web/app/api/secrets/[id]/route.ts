import type { NextRequest, NextResponse } from "next/server";
import {
  handleDeleteSecret,
  handleGetSecret,
  handleReplaceSecret,
  type SecretServiceContract,
} from "../handler";
import { createWebSecretService } from "@/secrets/secret-service";

/**
 * PH-M01-WO-003 — read, replace or delete a single tenant secret.
 *
 * The `id` path segment identifies the record; it is NOT authorization. The
 * tenant and the actor's role come from the server-resolved TenantContext, and
 * the vault refuses any id that does not belong to that tenant.
 *
 * GET returns METADATA ONLY (audit CR-03): the same seven-field allow-list as
 * every other secret response, through the same projection. No plaintext,
 * ciphertext, nonce, tag, key version, key material, length or last-4 suffix
 * crosses this boundary. There is still no plaintext read endpoint anywhere in
 * the API.
 */
const service: SecretServiceContract = createWebSecretService();

type RouteContext = { readonly params: Promise<{ id: string }> };

export async function GET(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  return handleGetSecret(request, service, context);
}

export async function PUT(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  return handleReplaceSecret(request, service, context);
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  return handleDeleteSecret(request, service, context);
}
