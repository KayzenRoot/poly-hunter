import type { NextRequest, NextResponse } from "next/server";
import { handleRotateSecret, type SecretServiceContract } from "../../handler";
import { createWebSecretService } from "@/secrets/secret-service";

/**
 * PH-M01-WO-003 — re-encrypt one tenant secret under the active key version.
 *
 * Single-record rotation only; there is no bulk rotation route in WO-003. The
 * response reports `rotated` or `already_current` plus the masked metadata, and
 * never any envelope material.
 */
const service: SecretServiceContract = createWebSecretService();

type RouteContext = { readonly params: Promise<{ id: string }> };

export async function POST(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  return handleRotateSecret(request, service, context);
}
