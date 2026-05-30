CREATE TABLE "round_questions" (
  "id" SERIAL PRIMARY KEY,
  "phaseNumber" INTEGER NOT NULL,
  "roundNumber" INTEGER NOT NULL,
  "questionIndex" INTEGER NOT NULL,
  "question" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "difficulty" TEXT NOT NULL,
  "timeLimit" INTEGER NOT NULL,
  "points" INTEGER NOT NULL,
  "answer" TEXT NOT NULL,
  "choices" JSONB NOT NULL,
  "payload" JSONB NOT NULL,
  "source" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "round_questions_phaseNumber_roundNumber_questionIndex_key"
ON "round_questions"("phaseNumber", "roundNumber", "questionIndex");
