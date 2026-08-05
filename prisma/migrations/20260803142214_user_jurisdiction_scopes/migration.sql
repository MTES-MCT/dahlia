-- CreateTable
CREATE TABLE "user_jurisdiction_scopes" (
    "userId" TEXT NOT NULL,
    "jurisdictionId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_jurisdiction_scopes_pkey" PRIMARY KEY ("userId","jurisdictionId")
);

-- CreateIndex
CREATE INDEX "user_jurisdiction_scopes_jurisdictionId_idx" ON "user_jurisdiction_scopes"("jurisdictionId");

-- AddForeignKey
ALTER TABLE "user_jurisdiction_scopes" ADD CONSTRAINT "user_jurisdiction_scopes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_jurisdiction_scopes" ADD CONSTRAINT "user_jurisdiction_scopes_jurisdictionId_fkey" FOREIGN KEY ("jurisdictionId") REFERENCES "jurisdictions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
