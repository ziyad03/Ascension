-- CreateTable
CREATE TABLE "Tournament" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'phase1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tournament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentPhase" (
    "id" SERIAL NOT NULL,
    "tournamentId" INTEGER,
    "phaseNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TournamentPhase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualifiedTeam" (
    "id" SERIAL NOT NULL,
    "tournamentId" INTEGER,
    "phaseNumber" INTEGER NOT NULL,
    "teamId" INTEGER,
    "teamName" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QualifiedTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EliminatedTeam" (
    "id" SERIAL NOT NULL,
    "tournamentId" INTEGER,
    "phaseNumber" INTEGER NOT NULL,
    "teamId" INTEGER,
    "teamName" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EliminatedTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengePack" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "sourceFilename" TEXT,
    "challengeCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChallengePack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportedChallenge" (
    "id" SERIAL NOT NULL,
    "packId" INTEGER NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "hint" TEXT,
    "category" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "penalty" INTEGER NOT NULL,
    "timeLimit" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportedChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HintUsage" (
    "id" SERIAL NOT NULL,
    "teamId" INTEGER,
    "teamName" TEXT NOT NULL,
    "challengeId" INTEGER,
    "hint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HintUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PenaltyLog" (
    "id" SERIAL NOT NULL,
    "teamId" INTEGER,
    "teamName" TEXT NOT NULL,
    "challengeId" INTEGER,
    "penalty" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PenaltyLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoundHistory" (
    "id" SERIAL NOT NULL,
    "phaseNumber" INTEGER NOT NULL,
    "challengeId" INTEGER,
    "winnerTeamId" INTEGER,
    "winnerName" TEXT,
    "submissions" JSONB,
    "scoreSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoundHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhaseResults" (
    "id" SERIAL NOT NULL,
    "tournamentId" INTEGER,
    "phaseNumber" INTEGER NOT NULL,
    "rankings" JSONB NOT NULL,
    "qualified" JSONB NOT NULL,
    "eliminated" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhaseResults_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ImportedChallenge" ADD CONSTRAINT "ImportedChallenge_packId_fkey" FOREIGN KEY ("packId") REFERENCES "ChallengePack"("id") ON DELETE CASCADE ON UPDATE CASCADE;
