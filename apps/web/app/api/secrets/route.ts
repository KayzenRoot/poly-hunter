import type { NextRequest, NextResponse } from "next/server";
import {
  handleCreateSecret,
  handleListSecrets,
  type SecretServiceContract,
} from "./handler";
import { createWebSecretService } from "@/secrets/secret-service";

/**
 * PH-M01-WO-003 — tenant secret metadata listing and creation.
 *
 * Wiring only: the handler owns the security policy and the response
 * projection. There is deliberately NO route here that returns plaintext, and
 * no route that accepts a tenant id — the tenant comes from the server-resolved
 * TenantContext inside the service.
 */
const service: SecretServiceContract = createWebSecretService();

export async function GET(request: NextRequest): Promise<NextResponse> {
  return handleListSecrets(request, service);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handleCreateSecret(request, service);
}
