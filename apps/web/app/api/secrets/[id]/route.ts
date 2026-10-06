import type { NextRequest, NextResponse } from "next/server";
import {
  handleDeleteSecret,
  handleReplaceSecret,
  type SecretServiceContract,
} from "../handler";
import { createWebSecretService } from "@/secrets/secret-service";

/**
 * PH-M01-WO-003 — replace or delete a single tenant secret.
 *
 * The `id` path segment identifies the record; it is NOT authorization. The
 * tenant and the actor's role come from the server-resolved TenantContext, and
 * the vault refuses any id that does not belong to that tenant.
 */
const service: SecretServiceContract = createWebSecretService();

type RouteContext = { readonly params: Promise<{ id: string }> };

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
