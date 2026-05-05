import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, tournamentsTable, scoresTable, gameSessionsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAdmin } from "../middlewares/auth.js";

const router = Router();

router.get("/admin/users", requireAdmin, async (_req, res) => {
  const users = await db
    .select({
      id: usersTable.id,
      discordUsername: usersTable.discordUsername,
      isAdmin: usersTable.isAdmin,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .orderBy(usersTable.createdAt);

  res.json({ users });
});

router.delete("/admin/users/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }
  await db.delete(usersTable).where(eq(usersTable.id, id));
  res.json({ ok: true });
});

router.post("/admin/tournament", requireAdmin, async (req, res) => {
  const { name, startTime, endTime, joinPassword } = req.body as {
    name?: string;
    startTime?: string;
    endTime?: string;
    joinPassword?: string;
  };

  if (!name || !startTime || !endTime || !joinPassword) {
    res.status(400).json({ error: "name, startTime, endTime, and joinPassword are required" });
    return;
  }

  if (joinPassword.length < 4) {
    res.status(400).json({ error: "Join password must be at least 4 characters" });
    return;
  }

  const start = new Date(startTime);
  const end = new Date(endTime);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
    res.status(400).json({ error: "Invalid start/end times" });
    return;
  }

  const [tournament] = await db
    .insert(tournamentsTable)
    .values({ name, joinPassword, startTime: start, endTime: end })
    .returning();

  res.json({ ok: true, tournament });
});

router.get("/admin/tournaments", requireAdmin, async (_req, res) => {
  const tournaments = await db
    .select()
    .from(tournamentsTable)
    .orderBy(tournamentsTable.startTime);

  res.json({ tournaments });
});

router.delete("/admin/tournaments/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid tournament id" });
    return;
  }
  // Delete child records first (no CASCADE on FK constraints)
  await db.delete(scoresTable).where(eq(scoresTable.tournamentId, id));
  await db.delete(gameSessionsTable).where(eq(gameSessionsTable.tournamentId, id));
  await db.delete(tournamentsTable).where(eq(tournamentsTable.id, id));
  res.json({ ok: true });
});

router.get("/admin/tournaments/:id/leaderboard", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid tournament id" });
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
    .where(eq(scoresTable.tournamentId, id))
    .groupBy(usersTable.discordUsername)
    .orderBy(sql`MAX(${scoresTable.score}) DESC`)
    .limit(50);
  res.json({ leaderboard });
});

router.post("/admin/change-password", requireAdmin, async (req, res) => {
  const { currentPassword, newPassword } = req.body as {
    currentPassword?: string;
    newPassword?: string;
  };

  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "currentPassword and newPassword are required" });
    return;
  }

  if (newPassword.length < 6) {
    res.status(400).json({ error: "New password must be at least 6 characters" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Current password is incorrect" });
    return;
  }

  const newHash = await bcrypt.hash(newPassword, 12);
  await db.update(usersTable).set({ passwordHash: newHash }).where(eq(usersTable.id, user.id));

  res.json({ ok: true });
});

export default router;
