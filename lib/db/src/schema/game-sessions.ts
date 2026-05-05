import { pgTable, serial, integer, boolean, timestamp, text } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { tournamentsTable } from "./tournaments";

export const gameSessionsTable = pgTable("game_sessions", {
  id: serial("id").primaryKey(),
  sessionToken: text("session_token").notNull().unique(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id),
  tournamentId: integer("tournament_id")
    .notNull()
    .references(() => tournamentsTable.id),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  submitted: boolean("submitted").notNull().default(false),
});

export type GameSession = typeof gameSessionsTable.$inferSelect;
