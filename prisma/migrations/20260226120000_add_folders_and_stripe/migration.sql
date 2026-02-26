-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stripe_customer_id" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stripe_sub_id" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "folders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "folders_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "pathways" ADD COLUMN IF NOT EXISTS "folder_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "users_stripe_customer_id_key" ON "users"("stripe_customer_id");
CREATE UNIQUE INDEX IF NOT EXISTS "users_stripe_sub_id_key" ON "users"("stripe_sub_id");
CREATE INDEX IF NOT EXISTS "pathways_folder_id_idx" ON "pathways"("folder_id");
CREATE INDEX IF NOT EXISTS "folders_user_id_idx" ON "folders"("user_id");

-- AddForeignKey
ALTER TABLE "pathways" DROP CONSTRAINT IF EXISTS "pathways_folder_id_fkey";
ALTER TABLE "pathways" ADD CONSTRAINT "pathways_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "folders" DROP CONSTRAINT IF EXISTS "folders_user_id_fkey";
ALTER TABLE "folders" ADD CONSTRAINT "folders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
