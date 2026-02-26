import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import prisma from "@/lib/prisma";

type Tier = "FREE" | "EXPLORER" | "PRO" | "ADVISER";

function getTierFromPriceId(priceId?: string | null): Tier {
  if (!priceId) return "FREE";
  if (priceId === process.env.STRIPE_ADVISER_PRICE_ID) return "ADVISER";
  if (priceId === process.env.STRIPE_PRO_PRICE_ID) return "PRO";
  if (priceId === process.env.STRIPE_EXPLORER_PRICE_ID) return "EXPLORER";
  return "EXPLORER";
}

export async function POST(req: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: "Webhook secret missing" }, { status: 400 });
  }

  let event: import("stripe").Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Webhook signature verification failed: ${message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as import("stripe").Stripe.Checkout.Session;
        const userId = session.client_reference_id ?? session.metadata?.userId;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;
        const metadataTier = session.metadata?.tier;
        const tier: Tier = metadataTier === "ADVISER" ? "ADVISER" : metadataTier === "PRO" ? "PRO" : metadataTier === "EXPLORER" ? "EXPLORER" : "EXPLORER";
        if (userId && customerId) {
          await prisma.user.update({
            where: { id: userId },
            data: {
              stripeCustomerId: customerId,
              stripeSubId: subscriptionId ?? undefined,
              subscriptionTier: tier,
            },
          });
        }
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object as import("stripe").Stripe.Subscription;
        const currentPriceId = sub.items.data[0]?.price?.id ?? null;
        const status = sub.status;
        const activeStatuses = new Set(["active", "trialing", "past_due"]);
        const nextTier: Tier = activeStatuses.has(status) ? getTierFromPriceId(currentPriceId) : "FREE";
        await prisma.user.updateMany({
          where: { stripeSubId: sub.id },
          data: { subscriptionTier: nextTier },
        });
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as import("stripe").Stripe.Subscription;
        await prisma.user.updateMany({
          where: { stripeSubId: sub.id },
          data: { stripeSubId: null, subscriptionTier: "FREE" },
        });
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error("Webhook handler error:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
