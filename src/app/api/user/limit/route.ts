import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/user";
import { checkPathwayLimit } from "@/lib/limit";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await getOrCreateUser(authUser);
    const { limitReached, pathwaysUsed, pathwayLimit } = checkPathwayLimit(dbUser);

    return NextResponse.json({
      limitReached,
      pathwaysUsed,
      pathwayLimit,
    });
  } catch (error) {
    console.error("User limit error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
