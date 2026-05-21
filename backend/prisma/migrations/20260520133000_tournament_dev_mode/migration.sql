ALTER TABLE "Tournament"
ADD COLUMN "developmentMode" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "isSkipped" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "simulatedResults" JSONB,
ADD COLUMN "generatedRankings" JSONB,
ADD COLUMN "mockTournamentState" JSONB;
