# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Pacific Pods Zombie Shooter — a tournament-based zombie shooting game with Discord authentication, leaderboards, and an admin panel.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (`artifacts/zombie-shooter/`)
- **API framework**: Express 5 (`artifacts/api-server/`)
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Auth**: JWT (jsonwebtoken + bcryptjs), SESSION_SECRET env var required

## App Features

- Tournament-based gameplay with start/end times
- Players log in with Discord username + tournament join password
- Admin panel at `/admin` for managing tournaments, players, and passwords
- Leaderboard with real-time scores
- 5 playable characters: OG Pod, POD MVP, Stone Pod, Fire Pod, The Squad
- Anti-cheat: devtools detection, console lock, right-click disable
- Demo mode for non-logged-in users

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Environment Variables Required

- `DATABASE_URL` — PostgreSQL connection string (auto-provisioned)
- `SESSION_SECRET` — JWT signing secret

## Key Files

- `artifacts/zombie-shooter/src/App.tsx` — routing (game / admin)
- `artifacts/zombie-shooter/src/pages/game.tsx` — main game canvas + UI
- `artifacts/zombie-shooter/src/pages/admin.tsx` — admin panel
- `artifacts/zombie-shooter/src/pages/login.tsx` — login page
- `artifacts/zombie-shooter/src/lib/api.ts` — API client
- `artifacts/api-server/src/routes/` — Express routes (auth, scores, tournament, admin)
- `lib/db/src/schema/` — Drizzle schema (users, tournaments, scores, game-sessions)

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
