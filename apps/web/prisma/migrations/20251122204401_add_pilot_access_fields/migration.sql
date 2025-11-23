-- AlterTable
ALTER TABLE "users" ADD COLUMN     "invitedBy" TEXT,
ADD COLUMN     "pilotEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pilotEndAt" TIMESTAMP(3),
ADD COLUMN     "pilotNotes" TEXT,
ADD COLUMN     "pilotRole" TEXT NOT NULL DEFAULT 'waitlist',
ADD COLUMN     "pilotStartAt" TIMESTAMP(3),
ADD COLUMN     "userType" TEXT NOT NULL DEFAULT 'civilian',
ADD COLUMN     "waitlistPosition" INTEGER;

-- CreateIndex
CREATE INDEX "users_pilotRole_idx" ON "users"("pilotRole");

-- CreateIndex
CREATE INDEX "users_pilotEnabled_idx" ON "users"("pilotEnabled");

-- CreateIndex
CREATE INDEX "users_waitlistPosition_idx" ON "users"("waitlistPosition");
