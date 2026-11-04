-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YoutubeConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "encryptedRefreshToken" TEXT NOT NULL,
    "scopes" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YoutubeConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LichessBotConnection" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "botUsername" TEXT NOT NULL,
    "encryptedTokenRef" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LichessBotConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "streamerUserId" TEXT NOT NULL,
    "youtubeBroadcastId" TEXT,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "settingsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'lichess',
    "platformGameId" TEXT,
    "botColor" TEXT NOT NULL DEFAULT 'black',
    "currentFen" TEXT NOT NULL DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lastPlatformEventAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Round" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "ply" INTEGER NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "opensAt" TIMESTAMP(3) NOT NULL,
    "closesAt" TIMESTAMP(3),
    "selectedMove" TEXT,
    "resultJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Round_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatEvent" (
    "id" TEXT NOT NULL,
    "platformMessageId" TEXT NOT NULL,
    "roundId" TEXT,
    "viewerPlatformId" TEXT NOT NULL,
    "viewerDisplayName" TEXT NOT NULL DEFAULT '',
    "rawText" TEXT NOT NULL,
    "parsedType" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MoveCandidate" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "viewerId" TEXT NOT NULL,
    "canonicalUci" TEXT NOT NULL,
    "san" TEXT NOT NULL,
    "valid" BOOLEAN NOT NULL DEFAULT true,
    "submissionCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MoveCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "viewerId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Score" (
    "sessionId" TEXT NOT NULL,
    "viewerId" TEXT NOT NULL,
    "viewerDisplayName" TEXT NOT NULL DEFAULT '',
    "points" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Score_pkey" PRIMARY KEY ("sessionId","viewerId")
);

-- CreateTable
CREATE TABLE "GameEvent" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "platformEventAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "YoutubeConnection_userId_channelId_key" ON "YoutubeConnection"("userId", "channelId");

-- CreateIndex
CREATE UNIQUE INDEX "LichessBotConnection_ownerUserId_botUsername_key" ON "LichessBotConnection"("ownerUserId", "botUsername");

-- CreateIndex
CREATE UNIQUE INDEX "Round_gameId_ply_key" ON "Round"("gameId", "ply");

-- CreateIndex
CREATE INDEX "ChatEvent_roundId_idx" ON "ChatEvent"("roundId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatEvent_platformMessageId_key" ON "ChatEvent"("platformMessageId");

-- CreateIndex
CREATE INDEX "MoveCandidate_roundId_idx" ON "MoveCandidate"("roundId");

-- CreateIndex
CREATE UNIQUE INDEX "MoveCandidate_roundId_viewerId_canonicalUci_key" ON "MoveCandidate"("roundId", "viewerId", "canonicalUci");

-- CreateIndex
CREATE INDEX "Vote_candidateId_idx" ON "Vote"("candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "Vote_roundId_viewerId_key" ON "Vote"("roundId", "viewerId");

-- CreateIndex
CREATE INDEX "GameEvent_gameId_idx" ON "GameEvent"("gameId");

-- AddForeignKey
ALTER TABLE "YoutubeConnection" ADD CONSTRAINT "YoutubeConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LichessBotConnection" ADD CONSTRAINT "LichessBotConnection_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_streamerUserId_fkey" FOREIGN KEY ("streamerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatEvent" ADD CONSTRAINT "ChatEvent_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoveCandidate" ADD CONSTRAINT "MoveCandidate_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "MoveCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Score" ADD CONSTRAINT "Score_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameEvent" ADD CONSTRAINT "GameEvent_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
