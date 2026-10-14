-- CreateTable
CREATE TABLE "telerecours_sync_rate_limits" (
    "key" VARCHAR(255) NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "expire" BIGINT,

    CONSTRAINT "telerecours_sync_rate_limits_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "telerecours_sync_rate_limits_expire_idx" ON "telerecours_sync_rate_limits"("expire");
