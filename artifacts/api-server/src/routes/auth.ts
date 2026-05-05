import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, tournamentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { signToken } from "../middlewares/auth.js";
import crypto from "crypto";

const router = Router();

router.post("/auth/login", async (req, res) => {
  const { discordUsername, password } = req.body as {
    discordUsername?: string;
    password?: string;
  };

  if (!discordUsername || !password) {
    res.status(400).json({ error: "discordUsername and password are required" });
    return;
  }

  const now = new Date();

  const [adminUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.discordUsername, discordUsername));

  if (adminUser?.isAdmin) {
    const valid = await bcrypt.compare(password, adminUser.passwordHash);
    if (valid) {
      const token = signToken({
        userId: adminUser.id,
        discordUsername: adminUser.discordUsername,
        isAdmin: true,
      });
      res.json({ token, discordUsername: adminUser.discordUsername, isAdmin: true });
      return;
    }
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const tournaments = await db.select().from(tournamentsTable);
  const matchingTournament = tournaments.find(
    (t) => t.joinPassword && t.joinPassword === password && new Date(t.endTime) >= now,
  );

  if (!matchingTournament) {
    res.status(401).json({ error: "Invalid tournament password" });
    return;
  }

  let player = adminUser;
  if (!player) {
    const existing = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.discordUsername, discordUsername));
    player = existing[0];
  }

  if (!player) {
    const randomHash = await bcrypt.hash(crypto.randomUUID(), 10);
    const [created] = await db
      .insert(usersTable)
      .values({ discordUsername, passwordHash: randomHash, isAdmin: false })
      .returning();
    player = created;
  }

  const token = signToken({
    userId: player.id,
    discordUsername: player.discordUsername,
    isAdmin: false,
  });

  res.json({
    token,
    discordUsername: player.discordUsername,
    isAdmin: false,
    tournamentId: matchingTournament.id,
    tournamentName: matchingTournament.name,
  });
});

export default router;
