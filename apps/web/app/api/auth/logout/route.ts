import type { NextResponse, NextRequest } from "next/server";
import { handleLogout, type LogoutDependencies } from "./handler";
import { clearActiveTenantSelection } from "@/identity/session-service";
import { createSupabaseIdentityAdapter } from "@/identity/supabase-adapter";

const dependencies: LogoutDependencies = {
  adapter: createSupabaseIdentityAdapter(),
  clearSelection: clearActiveTenantSelection,
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handleLogout(request, dependencies);
}
