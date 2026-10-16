-- CreateTable
CREATE TABLE "IncidentRevision" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "summary" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "previous" TEXT,
    "next" TEXT,

    CONSTRAINT "IncidentRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IncidentRevision_incidentId_recordedAt_idx" ON "IncidentRevision"("incidentId", "recordedAt");

-- AddForeignKey
ALTER TABLE "IncidentRevision" ADD CONSTRAINT "IncidentRevision_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
