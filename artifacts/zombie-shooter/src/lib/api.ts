declare const __API_BASE__: string;
const BASE = (typeof __API_BASE__ !== "undefined" ? __API_BASE__ : "") + "/api";

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
  tournamentId?: number;
  tournamentName?: string;
}

export interface Tournament {
  id: number;
  name: string;
  joinPassword: string;
  startTime: string;
  endTime: string;
}

export interface TournamentStatus {
  status: "active" | "upcoming" | "ended" | "none";
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
    listUsers: () =>
      req<{ users: AdminUser[] }>("GET", "/admin/users", undefined, true),
    deleteUser: (id: number) =>
      req<{ ok: boolean }>("DELETE", `/admin/users/${id}`, undefined, true),
    createTournament: (name: string, startTime: string, endTime: string, joinPassword: string) =>
      req<{ ok: boolean; tournament: Tournament }>(
        "POST", "/admin/tournament", { name, startTime, endTime, joinPassword }, true,
      ),
    listTournaments: () =>
      req<{ tournaments: Tournament[] }>("GET", "/admin/tournaments", undefined, true),
    deleteTournament: (id: number) =>
      req<{ ok: boolean }>("DELETE", `/admin/tournaments/${id}`, undefined, true),
    tournamentLeaderboard: (id: number) =>
      req<{ leaderboard: LeaderboardEntry[] }>("GET", `/admin/tournaments/${id}/leaderboard`, undefined, true),
    changePassword: (currentPassword: string, newPassword: string) =>
      req<{ ok: boolean }>("POST", "/admin/change-password", { currentPassword, newPassword }, true),
  },
};
