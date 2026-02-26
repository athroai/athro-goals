import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateUser } from "@/lib/user";
import { stripe } from "@/lib/stripe";

function getTierFromPrice(priceId: string): "EXPLORER" | "PRO" | "ADVISER" {
  if (priceId === process.env.STRIPE_ADVISER_PRICE_ID) return "ADVISER";
  if (priceId === process.env.STRIPE_PRO_PRICE_ID) return "PRO";
  return "EXPLORER";
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await getOrCreateUser(authUser);

    const body = await req.json();
    const { priceId, tier: requestedTier, returnTo } = body as { priceId?: string; tier?: "EXPLORER" | "PRO" | "ADVISER"; returnTo?: string };
    const tierPrice =
      requestedTier === "ADVISER"
        ? process.env.STRIPE_ADVISER_PRICE_ID
        : requestedTier === "PRO"
          ? process.env.STRIPE_PRO_PRICE_ID
          : requestedTier === "EXPLORER"
            ? process.env.STRIPE_EXPLORER_PRICE_ID
            : undefined;
    const price = priceId ?? tierPrice ?? process.env.STRIPE_EXPLORER_PRICE_ID ?? process.env.STRIPE_PRO_PRICE_ID;
    if (!price || !stripe) {
      return NextResponse.json(
        { error: "Checkout not configured" },
        { status: 503 }
      );
    }

    const tier = getTierFromPrice(price);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const successPath = returnTo && returnTo.startsWith("/") ? returnTo : "/dashboard";
    const sep = successPath.includes("?") ? "&" : "?";
    const successUrl = `${baseUrl}${successPath}${sep}success=true`;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price, quantity: 1 }],
      success_url: successUrl,
      cancel_url: `${baseUrl}/settings`,
      customer_email: dbUser.email,
      client_reference_id: dbUser.id,
      metadata: { userId: dbUser.id, tier },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
