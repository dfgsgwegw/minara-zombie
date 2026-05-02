const BASE = (import.meta.env.VITE_API_URL ?? "") + "/api";

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function req<T>(
  method: string,
  path: string,
  body?: unknown,
  auth = false,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(auth ? authHeaders() : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Could not reach the server. Check your connection.");
  }
  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Server returned an unexpected response (${res.status}).`);
  }
  if (!res.ok) throw new Error((data.error as string) ?? `Request failed (${res.status})`);
  return data as T;
}

export interface LoginResponse {
  token: string;
  discordUsername: string;
  isAdmin: boolean;
}

export interface Tournament {
  id: number;
  name: string;
  startTime: string;
  endTime: string;
}

export interface TournamentStatus {
  status: "active" | "upcoming" | "none";
  tournament: Tournament | null;
}

export interface LeaderboardEntry {
  rank: number;
  discordUsername: string;
  bestScore: number;
  gamesPlayed: number;
}

export interface LeaderboardResponse {
  tournament: Tournament | null;
  leaderboard: LeaderboardEntry[];
}

export interface AdminUser {
  id: number;
  discordUsername: string;
  isAdmin: boolean;
  createdAt: string;
}

export const api = {
  login: (discordUsername: string, password: string) =>
    req<LoginResponse>("POST", "/auth/login", { discordUsername, password }),

  currentTournament: () =>
    req<TournamentStatus>("GET", "/tournament/current"),

  startSession: () =>
    req<{ sessionToken: string }>("POST", "/scores/start", {}, true),

  submitScore: (score: number, sessionToken: string) =>
    req<{ ok: boolean }>("POST", "/scores", { score, sessionToken }, true),

  leaderboard: () =>
    req<LeaderboardResponse>("GET", "/leaderboard"),

  admin: {
    createUser: (discordUsername: string, password: string, isAdmin = false) =>
      req<{ ok: boolean; user: { id: number; discordUsername: string } }>(
        "POST", "/admin/users", { discordUsername, password, isAdmin }, true,
      ),
    listUsers: () =>
      req<{ users: AdminUser[] }>("GET", "/admin/users", undefined, true),
    deleteUser: (id: number) =>
      req<{ ok: boolean }>("DELETE", `/admin/users/${id}`, undefined, true),
    createTournament: (name: string, startTime: string, endTime: string) =>
      req<{ ok: boolean; tournament: Tournament }>(
        "POST", "/admin/tournament", { name, startTime, endTime }, true,
      ),
    listTournaments: () =>
      req<{ tournaments: Tournament[] }>("GET", "/admin/tournaments", undefined, true),
  },
};
