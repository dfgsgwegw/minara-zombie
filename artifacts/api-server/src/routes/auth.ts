import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { signToken } from "../middlewares/auth";

const router: IRouter = Router();

router.post("/auth/login", async (req, res) => {
  const { discordUsername, password } = req.body as {
    discordUsername?: string;
    password?: string;
  };

  if (!discordUsername || !password) {
    res.status(400).json({ error: "discordUsername and password are required" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.discordUsername, discordUsername));

  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = signToken({
    userId: user.id,
    discordUsername: user.discordUsername,
    isAdmin: user.isAdmin,
  });

  res.json({ token, discordUsername: user.discordUsername, isAdmin: user.isAdmin });
});

export default router;
