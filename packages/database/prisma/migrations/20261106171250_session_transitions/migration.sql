-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "pausedFrom" TEXT;

-- CreateTable
CREATE TABLE "SessionTransition" (
    "id" SERIAL NOT NULL,
    "sessionId" TEXT NOT NULL,
    "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionTransition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SessionTransition_sessionId_id_idx" ON "SessionTransition"("sessionId", "id");

-- AddForeignKey
ALTER TABLE "SessionTransition" ADD CONSTRAINT "SessionTransition_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

