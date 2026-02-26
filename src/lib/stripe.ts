import Stripe from "stripe";

export const stripe =
  process.env.STRIPE_SECRET_KEY
    ? new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: "2026-02-25.clover",
        typescript: true,
      })
    : null;

export function getStripeCustomerPortalUrl(customerId: string): string {
  return `https://billing.stripe.com/p/login/customers/${customerId}`;
}
