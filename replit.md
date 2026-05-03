# Pacific Zombie Fighter — Full Project Reference

> **Purpose of this file:** If this repo is imported into a new Replit workspace, this document gives the AI agent (and any human developer) a complete picture of the project — architecture, files, environment variables, deployment, and admin usage — so nothing needs to be rebuilt from scratch.

---

## 1. What This Project Is

**Pacific Zombie Fighter** is a browser-based zombie-shooter tournament game. Players log in with their Discord username and a tournament password, play a canvas-based shooting game, and their score is automatically recorded on a live leaderboard. Admins create and manage tournaments from a protected dashboard.

**Live URL (Vercel):** auto-deployed from the `main` branch via Vercel.

---

## 2. Monorepo Structure

```
/
├── artifacts/
│   ├── zombie-shooter/        # React + Vite frontend (the game)
│   └── api-server/            # Express 5 API server
├── lib/
│   ├── db/                    # Drizzle ORM + Neon PostgreSQL
│   ├── api-spec/              # OpenAPI spec + Orval codegen config
│   ├── api-zod/               # Zod schemas generated from OpenAPI spec
│   └── api-client-react/      # React Query hooks generated from OpenAPI spec
├── api/
│   └── index.mjs              # Vercel serverless entry point
├── vercel.json                # Vercel build + routing config
├── pnpm-workspace.yaml
└── package.json               # Root workspace (pnpm)
```

**Package manager:** `pnpm` (workspaces). Node 24. TypeScript 5.9.  
**Do NOT use npm or yarn** — a preinstall guard will reject them.

---

## 3. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, Wouter (routing) |
| Game engine | HTML5 Canvas (vanilla, no library) |
| API server | Express 5 (ESM), Pino logging |
| Auth | JWT (`jsonwebtoken`), bcryptjs, `SESSION_SECRET` env var |
| Database | PostgreSQL via Neon (serverless), Drizzle ORM |
| Deployment | Vercel (frontend SPA + API serverless function) |
| Dev environment | Replit (pnpm workspaces, workflows) |

---

## 4. Environment Variables

Both dev (Replit) and production (Vercel) need these set:

| Variable | Where to set | Description |
|---|---|---|
| `DATABASE_URL` | Replit Secrets + Vercel env | Neon PostgreSQL connection string (`postgres://...`) |
| `SESSION_SECRET` | Replit Secrets + Vercel env | Random secret for JWT signing (min 32 chars) |

**Important:** Replit dev and Vercel production use **separate Neon databases**. If you add an admin user in dev, you must also add it in the Vercel database. See §9 for admin setup SQL.

---

## 5. Running Locally (Replit)

The Replit environment has two workflows configured:

| Workflow name | Command | Purpose |
|---|---|---|
| `artifacts/zombie-shooter: web` | `pnpm --filter @workspace/zombie-shooter run dev` | Vite dev server (frontend) |
| `artifacts/api-server: API Server` | `pnpm --filter @workspace/api-server run dev` | Express API server |

Both start automatically. The frontend proxies `/api` calls to the API server via Vite's `__API_BASE__` injection.

**Key dev commands (run from project root):**

```bash
# Install all deps
pnpm install

# Full typecheck
pnpm run typecheck

# Push DB schema changes to dev database
pnpm --filter @workspace/db run push

# Run API server only
pnpm --filter @workspace/api-server run dev

# Run frontend only
pnpm --filter @workspace/zombie-shooter run dev
```

---

## 6. Database Schema

All tables live in `lib/db/src/schema/`.

### `users`
| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `discord_username` | text UNIQUE | Player display name |
| `password_hash` | bcrypt hash | Admin: real password. Players: random UUID hash (login via tournament password only) |
| `is_admin` | boolean | `false` for players |
| `created_at` | timestamp | |

### `tournaments`
| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `name` | text | Display name |
| `join_password` | text | Players use this to log in (min 4 chars) |
| `start_time` | timestamp | Tournament begins |
| `end_time` | timestamp | Tournament ends; scores blocked after this |
| `created_at` | timestamp | |

### `scores`
| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `user_id` | FK → users | |
| `tournament_id` | FK → tournaments | |
| `score` | integer | |
| `played_at` | timestamp | |

### `game_sessions`
| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `session_token` | text UNIQUE | UUID issued at game start, burned on score submit |
| `user_id` | FK → users | |
| `tournament_id` | FK → tournaments | |
| `started_at` | timestamp | |
| `submitted` | boolean | Prevents double-submit |

**Schema migrations:** Run `pnpm --filter @workspace/db run push` to apply schema changes to the target database (controlled by `DATABASE_URL`).

---

## 7. API Routes

Base path: `/api`  
Auth: `Authorization: Bearer <jwt>` header.

### Auth
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login` | None | Login. Returns JWT. See §7a. |

### Tournament (public)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/tournament/current` | None | Returns `{ status, tournament }`. Status: `active`, `upcoming`, `ended`, `none`. |

### Scores
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/scores/start` | Player | Creates a game session, returns `sessionToken`. Requires active tournament. |
| POST | `/api/scores` | Player | Submits score. Body: `{ score, sessionToken }`. One submission per session. |
| GET | `/api/leaderboard` | None | Top 50 players for current (or most recent) tournament. |

### Admin (requires `isAdmin: true` in JWT)
| Method | Path | Description |
|---|---|---|
| GET | `/api/admin/users` | List all users |
| DELETE | `/api/admin/users/:id` | Delete a user |
| POST | `/api/admin/tournament` | Create tournament. Body: `{ name, startTime, endTime, joinPassword }` |
| DELETE | `/api/admin/tournament/:id` | Delete tournament (and all its scores) |
| GET | `/api/admin/leaderboard/:tournamentId` | Leaderboard for a specific tournament |

### System
| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Returns `{ status: "ok" }` |

#### §7a — Login Logic
1. **Admin login:** Username exists in DB as `is_admin = true` → bcrypt compare their stored hash. Wrong password = 401 (no fallthrough).
2. **Player login:** Username not found (or not admin) → search for a non-ended tournament whose `join_password` matches the supplied password → auto-create player account if username is new → return JWT with `isAdmin: false`.

JWT expiry: **12 hours**. Signed with `SESSION_SECRET`.

---

## 8. Frontend Pages & Flow

All pages live in `artifacts/zombie-shooter/src/pages/`.

| Page | Route | Description |
|---|---|---|
| `game.tsx` | `/` | Main game page. Contains all tournament logic. |
| `admin.tsx` | `/admin` | Admin dashboard (tournament CRUD, user list). |
| `leaderboard.tsx` | `/leaderboard` | Public leaderboard. |
| `login.tsx` | — | Login modal/page (used inline). |

### Game Page State Machine (`gameState`)
```
menu  →  character  →  playing  →  over
                   ↗              ↓
              (play again)    (play again / menu)
```

- **`menu`** — Shows tournament banner (logged-in), demo button (guests), login form.
- **`character`** — Character selection (4 characters).
- **`playing`** — Active canvas game loop. Score increments as zombies are killed.
- **`over`** — Shows final score. Auto-submits score. "Play Again" button if tournament still active.

### Tournament Status Sync
The frontend polls `GET /api/tournament/current` on mount and after login. A 1-second `setInterval` tick recalculates status client-side from cached `startMs`/`endMs` timestamps — no refresh needed when a tournament transitions from upcoming → active.

### Score Submission (automatic)
1. On game start → `POST /api/scores/start` → receive `sessionToken`.
2. On game over → `autoSubmitScore()` → `POST /api/scores` with `{ score, sessionToken }`.
3. If tournament ends *while the game is running*, the tick interval detects it and triggers `autoSubmitScore()` immediately with the current score.
4. There is **no manual submit button**. Score is always auto-submitted.

### Auth Storage
JWT stored in `localStorage` as `token`. User info stored as `user` JSON. Helper functions in `artifacts/zombie-shooter/src/lib/auth.ts`.

### Play Modes
- **`"tournament"`** — Only available to logged-in users during an active tournament. Score submitted automatically. Guests see a login prompt.
- **`"demo"`** — Available to guests (no active tournament, or user not logged in). Score is NOT submitted.

Logged-in users are **locked to tournament mode** — no demo option shown.

---

## 9. Admin Setup

### Creating the first admin account

Run this SQL in the Neon console for the target database (replace hash with a bcrypt hash of your chosen password):

```sql
-- Generate hash first: node -e "const b=require('bcryptjs'); b.hash('Admin123!',10).then(console.log)"
INSERT INTO users (discord_username, password_hash, is_admin)
VALUES ('Stella', '<bcrypt-hash-here>', true);
```

Or to promote an existing user:
```sql
UPDATE users SET is_admin = true WHERE discord_username = 'Stella';
```

To fix an admin's password (e.g., update display username):
```sql
UPDATE users SET discord_username = 'Stella' WHERE is_admin = true;
```

**Current admin credentials:**
- Username: `Stella`
- Password: `Admin123!`
- ⚠️ Change these for any real deployment.

### Admin Dashboard (`/admin`)

- **Create Tournament** — name, start datetime, end datetime, join password (min 4 chars).
- **Delete Tournament** — removes tournament and all associated scores.
- **View Users** — list of all registered players; delete individual users.
- **View Leaderboard** — per-tournament leaderboard with rank, best score, games played.

---

## 10. Vercel Deployment

### How It Works

```
vercel.json
  buildCommand: pnpm --filter @workspace/api-server run build:vercel
                && pnpm --filter @workspace/zombie-shooter run build:vercel
  outputDirectory: artifacts/zombie-shooter/dist/public   (static SPA)
  functions:
    api/index.mjs  → maxDuration 30s

Rewrites:
  /api/:path*  →  api/index.mjs (serverless function)
  /*           →  /index.html   (SPA fallback)
```

### API Build for Vercel

`artifacts/api-server/build-vercel.mjs` uses **esbuild** to bundle `src/routes/index.ts` → `dist/routes.mjs` (ESM, bundled, Node platform).

`api/index.mjs` then imports `dist/routes.mjs` and wraps it in an Express app with CORS, serving all routes under `/api`.

### Frontend Build for Vercel

`artifacts/zombie-shooter/vite.config.vercel.ts` builds with `base: "/"` and outputs to `dist/public`. The `__API_BASE__` define is set to `""` (empty — same origin, so `/api/...` paths work directly).

### Vercel Environment Variables
Set these in the Vercel project dashboard:
- `DATABASE_URL` — Neon connection string for the **production** database
- `SESSION_SECRET` — same strong secret used in dev (or a different one)

### Auto-Deploy
Vercel is linked to the GitHub repo. Every push to `main` triggers a new deployment automatically.

---

## 11. Local Dev vs Vercel — Two Separate Databases

| Environment | Database host | Admin user |
|---|---|---|
| Replit dev | Neon `helium` branch | `Stella` (already seeded) |
| Vercel production | Neon default/main branch | Must be seeded separately |

If admin login works in dev but not in production (or vice versa), the user row only exists in one DB. Run the INSERT SQL above in the Neon console for whichever environment is missing it.

---

## 12. Key Files Quick Reference

| File | Purpose |
|---|---|
| `artifacts/zombie-shooter/src/pages/game.tsx` | Entire game: canvas loop, tournament logic, score auto-submit, countdown |
| `artifacts/zombie-shooter/src/pages/admin.tsx` | Admin dashboard UI |
| `artifacts/zombie-shooter/src/lib/api.ts` | Typed API client (fetch wrapper) |
| `artifacts/zombie-shooter/src/lib/auth.ts` | localStorage JWT helpers |
| `artifacts/api-server/src/routes/auth.ts` | Login: admin bcrypt + tournament password auto-create |
| `artifacts/api-server/src/routes/admin.ts` | Admin CRUD endpoints |
| `artifacts/api-server/src/routes/scores.ts` | Game session start + score submit + leaderboard |
| `artifacts/api-server/src/routes/tournament.ts` | `GET /api/tournament/current` |
| `artifacts/api-server/src/middlewares/auth.ts` | JWT sign/verify, `requireAuth`, `requireAdmin` |
| `lib/db/src/schema/` | Drizzle table definitions (users, tournaments, scores, game_sessions) |
| `lib/db/src/index.ts` | Drizzle client (uses `DATABASE_URL`) |
| `api/index.mjs` | Vercel serverless entry — wraps compiled routes |
| `artifacts/api-server/build-vercel.mjs` | esbuild script for Vercel API bundle |
| `vercel.json` | Vercel project config |

---

## 13. Common Tasks

### Add a new API route
1. Add route handler in `artifacts/api-server/src/routes/<name>.ts`.
2. Register it in `artifacts/api-server/src/routes/index.ts`.
3. Add a matching function to `artifacts/zombie-shooter/src/lib/api.ts`.

### Change the DB schema
1. Edit files in `lib/db/src/schema/`.
2. Run `pnpm --filter @workspace/db run push` to apply to dev DB.
3. For production, run the same command with `DATABASE_URL` pointing at the Vercel Neon DB, or apply raw SQL via the Neon console.

### Add a new tournament (programmatically)
```sql
INSERT INTO tournaments (name, join_password, start_time, end_time)
VALUES ('Round 1', 'fight2025', '2025-06-01 10:00:00', '2025-06-01 12:00:00');
```

### Reset all scores for a tournament
```sql
DELETE FROM scores WHERE tournament_id = <id>;
DELETE FROM game_sessions WHERE tournament_id = <id>;
```

---

## 14. Known Quirks & Notes

- **`.migration-backup/` folder** — old copy of artifacts from a Replit migration. The workflows for it are expected to fail and can be ignored.
- **Session tokens are single-use.** Once `POST /api/scores` succeeds, the token cannot be reused (the `submitted` flag is set). A new `POST /api/scores/start` is required for each game.
- **Leaderboard shows best score per player**, not total score. Multiple games are allowed per player per tournament.
- **Mobile controls** — the game has touch-based controls (virtual joystick + fire button) for mobile browsers.
- **DevTools detection** — if the browser devtools are open during a game, the score is invalidated client-side and marked with a warning. (This is a soft deterrent, not server-enforced.)
- **JWT is stored in localStorage** — acceptable for this use case. If security requirements increase, migrate to HttpOnly cookies.
