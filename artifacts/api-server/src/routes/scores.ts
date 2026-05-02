import { Router } from "express";
import { db, scoresTable, tournamentsTable, usersTable, gameSessionsTable } from "@workspace/db";
import { eq, and, lte, gte, desc, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";
import { randomUUID } from "crypto";

const router = Router();

router.post("/scores/start", requireAuth, async (req, res) => {
  const user = req.user!;
  const now = new Date();

  const [tournament] = await db
    .select()
    .from(tournamentsTable)
    .where(and(lte(tournamentsTable.startTime, now), gte(tournamentsTable.endTime, now)))
    .orderBy(desc(tournamentsTable.createdAt))
    .limit(1);

  if (!tournament) {
    res.status(400).json({ error: "No active tournament" });
    return;
  }

  const sessionToken = randomUUID();

  await db.insert(gameSessionsTable).values({
    sessionToken,
    userId: user.userId,
    tournamentId: tournament.id,
    startedAt: now,
    submitted: false,
  });

  res.json({ sessionToken });
});

router.post("/scores", requireAuth, async (req, res) => {
  const { score, sessionToken } = req.body as { score?: unknown; sessionToken?: unknown };
  const user = req.user!;

  if (typeof score !== "number" || !Number.isInteger(score) || score < 0) {
    res.status(400).json({ error: "Invalid score" });
    return;
  }

  if (typeof sessionToken !== "string" || !sessionToken) {
    res.status(400).json({ error: "sessionToken required" });
    return;
  }

  const [session] = await db
    .select()
    .from(gameSessionsTable)
    .where(eq(gameSessionsTable.sessionToken, sessionToken));

  if (!session) {
    res.status(403).json({ error: "Invalid session" });
    return;
  }

  if (session.userId !== user.userId) {
    res.status(403).json({ error: "Session does not belong to you" });
    return;
  }

  if (session.submitted) {
    res.status(409).json({ error: "Score already submitted for this session" });
    return;
  }

  await db
    .update(gameSessionsTable)
    .set({ submitted: true })
    .where(eq(gameSessionsTable.id, session.id));

  await db.insert(scoresTable).values({
    userId: user.userId,
    tournamentId: session.tournamentId,
    score,
  });

  res.json({ ok: true, score });
});

router.get("/leaderboard", async (_req, res) => {
  const now = new Date();

  const [active] = await db
    .select()
    .from(tournamentsTable)
    .where(and(lte(tournamentsTable.startTime, now), gte(tournamentsTable.endTime, now)))
    .orderBy(desc(tournamentsTable.createdAt))
    .limit(1);

  const targetTournament =
    active ??
    (await db
      .select()
      .from(tournamentsTable)
      .orderBy(desc(tournamentsTable.endTime))
      .limit(1)
      .then((r) => r[0]));

  if (!targetTournament) {
    res.json({ tournament: null, leaderboard: [] });
    return;
  }

  const leaderboard = await db
    .select({
      rank: sql<number>`RANK() OVER (ORDER BY MAX(${scoresTable.score}) DESC)`,
      discordUsername: usersTable.discordUsername,
      bestScore: sql<number>`MAX(${scoresTable.score})`,
      gamesPlayed: sql<number>`COUNT(${scoresTable.id})`,
    })
    .from(scoresTable)
    .innerJoin(usersTable, eq(scoresTable.userId, usersTable.id))
    .where(eq(scoresTable.tournamentId, targetTournament.id))
    .groupBy(usersTable.discordUsername)
    .orderBy(sql`MAX(${scoresTable.score}) DESC`)
    .limit(50);

  res.json({ tournament: targetTournament, leaderboard });
});

export default router;
