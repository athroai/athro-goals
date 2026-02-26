-- AlterTable: add checklist and definite_date_iso to pathway_steps
ALTER TABLE "pathway_steps" ADD COLUMN IF NOT EXISTS "checklist" JSONB;
ALTER TABLE "pathway_steps" ADD COLUMN IF NOT EXISTS "definite_date_iso" TEXT;

-- CreateTable: pathway_progress for user completions and custom dates
CREATE TABLE IF NOT EXISTS "pathway_progress" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "pathway_id" UUID NOT NULL,
    "step_completions" JSONB,
    "custom_dates" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pathway_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "pathway_progress_user_id_pathway_id_key" ON "pathway_progress"("user_id", "pathway_id");
CREATE INDEX IF NOT EXISTS "pathway_progress_pathway_id_idx" ON "pathway_progress"("pathway_id");

-- AddForeignKey
ALTER TABLE "pathway_progress" DROP CONSTRAINT IF EXISTS "pathway_progress_user_id_fkey";
ALTER TABLE "pathway_progress" ADD CONSTRAINT "pathway_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pathway_progress" DROP CONSTRAINT IF EXISTS "pathway_progress_pathway_id_fkey";
ALTER TABLE "pathway_progress" ADD CONSTRAINT "pathway_progress_pathway_id_fkey" FOREIGN KEY ("pathway_id") REFERENCES "pathways"("id") ON DELETE CASCADE ON UPDATE CASCADE;
