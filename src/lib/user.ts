import type { User as SupabaseAuthUser } from "@supabase/supabase-js";
import prisma from "@/lib/prisma";

/**
 * Returns the app User for the given Supabase auth user, creating a row if missing.
 */
export async function getOrCreateUser(authUser: SupabaseAuthUser) {
  const existing = await prisma.user.findUnique({
    where: { supabaseAuthId: authUser.id },
  });
  if (existing) return existing;

  return prisma.user.create({
    data: {
      supabaseAuthId: authUser.id,
      email: authUser.email ?? "",
      name:
        authUser.user_metadata?.full_name ??
        authUser.user_metadata?.name ??
        null,
    },
  });
}
