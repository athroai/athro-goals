-- Ensure SubscriptionTier enum exists (for fresh DBs or if missing)
DO $$ BEGIN
  CREATE TYPE "SubscriptionTier" AS ENUM ('FREE', 'EXPLORER', 'PRO', 'ADVISER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add subscription_tier to users if missing (e.g. DB created before tier was added)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subscription_tier" "SubscriptionTier" NOT NULL DEFAULT 'FREE';
