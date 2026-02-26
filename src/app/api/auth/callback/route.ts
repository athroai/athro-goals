import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=no_code", req.url));
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (authError || !user) {
    console.error("Auth callback error:", authError);
    return NextResponse.redirect(new URL("/login?error=callback", req.url));
  }

  const existing = await prisma.user.findUnique({
    where: { supabaseAuthId: user.id },
  });

  if (!existing) {
    await prisma.user.create({
      data: {
        supabaseAuthId: user.id,
        email: user.email ?? "",
        name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
      },
    });
  }

  return NextResponse.redirect(new URL(next, req.url));
}
