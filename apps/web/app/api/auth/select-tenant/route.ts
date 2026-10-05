import type { NextResponse, NextRequest } from "next/server";
import { handleSelectTenant, type SelectTenantDependencies } from "./handler";
import {
  createWebIdentityService,
  writeActiveTenantSelection,
} from "@/identity/session-service";
import { isSupabaseConfigured } from "@/identity/supabase-adapter";

const dependencies: SelectTenantDependencies = {
  service: createWebIdentityService(),
  providerConfigured: isSupabaseConfigured(),
  writeSelection: writeActiveTenantSelection,
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handleSelectTenant(request, dependencies);
}
