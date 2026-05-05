import { useEffect, useState } from "react";
import { api, AdminUser, Tournament, LeaderboardEntry } from "@/lib/api";

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

interface Props {
  onBack: () => void;
}

function formatLocal(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function TournamentStatus({ t }: { t: Tournament }) {
  const now = new Date();
  const start = new Date(t.startTime);
  const end = new Date(t.endTime);
  const active = start <= now && end >= now;
  const upcoming = start > now;
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded font-bold ${
        active
          ? "bg-green-500/20 text-green-400"
          : upcoming
          ? "bg-yellow-500/20 text-yellow-400"
          : "bg-white/10 text-white/30"
      }`}
    >
      {active ? "LIVE" : upcoming ? "UPCOMING" : "ENDED"}
    </span>
  );
}

export default function AdminPage({ onBack }: Props) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [tab, setTab] = useState<"players" | "tournament" | "settings">("tournament");

  const now = new Date();
  const [tourneyName, setTourneyName] = useState("Zombie Shooter Tournament");
  const [joinPassword, setJoinPassword] = useState("");
  const [showJoinPw, setShowJoinPw] = useState(false);
  const [startTime, setStartTime] = useState(formatLocal(now));
  const [endTime, setEndTime] = useState(
    formatLocal(new Date(now.getTime() + 4 * 3600 * 1000)),
  );
  const [tourneyMsg, setTourneyMsg] = useState("");
  const [tourneyErr, setTourneyErr] = useState("");

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [pwErr, setPwErr] = useState("");

  const [revealedPw, setRevealedPw] = useState<Record<number, boolean>>({});
  const [expandedLb, setExpandedLb] = useState<Record<number, boolean>>({});
  const [lbData, setLbData] = useState<Record<number, LeaderboardEntry[]>>({});
  const [lbLoading, setLbLoading] = useState<Record<number, boolean>>({});

  async function toggleLeaderboard(id: number) {
    if (expandedLb[id]) {
      setExpandedLb((prev) => ({ ...prev, [id]: false }));
      return;
    }
    setExpandedLb((prev) => ({ ...prev, [id]: true }));
    if (lbData[id]) return;
    setLbLoading((prev) => ({ ...prev, [id]: true }));
    try {
      const { leaderboard } = await api.admin.tournamentLeaderboard(id);
      setLbData((prev) => ({ ...prev, [id]: leaderboard }));
    } catch {}
    setLbLoading((prev) => ({ ...prev, [id]: false }));
  }

  async function loadData() {
    try {
      const [u, t] = await Promise.all([
        api.admin.listUsers(),
        api.admin.listTournaments(),
      ]);
      setUsers(u.users);
      setTournaments(t.tournaments);
    } catch {}
  }

  useEffect(() => {
    loadData();
  }, []);

  async function deleteUser(id: number, name: string) {
    if (!confirm(`Remove ${name} from the player list?`)) return;
    await api.admin.deleteUser(id);
    loadData();
  }

  async function deleteTournament(id: number, name: string) {
    if (!confirm(`Delete "${name}"? This will remove it permanently.`)) return;
    await api.admin.deleteTournament(id);
    loadData();
  }

  async function createTournament(e: React.FormEvent) {
    e.preventDefault();
    setTourneyMsg("");
    setTourneyErr("");
    try {
      await api.admin.createTournament(
        tourneyName,
        new Date(startTime).toISOString(),
        new Date(endTime).toISOString(),
        joinPassword,
      );
      setTourneyMsg("Tournament created! Share the join password with players.");
      setJoinPassword("");
      loadData();
    } catch (err: unknown) {
      setTourneyErr(err instanceof Error ? err.message : "Failed");
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg("");
    setPwErr("");
    if (newPw !== confirmPw) {
      setPwErr("New passwords do not match");
      return;
    }
    try {
      await api.admin.changePassword(currentPw, newPw);
      setPwMsg("Password changed successfully!");
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    } catch (err: unknown) {
      setPwErr(err instanceof Error ? err.message : "Failed to change password");
    }
  }

  const nonAdminUsers = users.filter((u) => !u.isAdmin);

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-6 pt-4">
          <button
            onClick={onBack}
            className="text-green-400 hover:text-green-300 text-sm tracking-widest uppercase border border-green-500/30 px-4 py-2 rounded"
          >
            ← Back
          </button>
          <h1 className="text-2xl font-black text-green-400 tracking-widest">ADMIN PANEL</h1>
        </div>

        <div className="flex mb-6 border-b border-white/10">
          {(["tournament", "players", "settings"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-6 py-3 font-bold tracking-widest uppercase text-sm transition ${
                tab === t
                  ? "border-b-2 border-green-400 text-green-400"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              {t === "players" ? `Players (${nonAdminUsers.length})` : t}
            </button>
          ))}
        </div>

        {tab === "tournament" && (
          <div className="space-y-6">
            <form
              onSubmit={createTournament}
              className="bg-white/5 border border-white/10 rounded-lg p-6 space-y-4"
            >
              <h2 className="font-bold text-white/80 tracking-wider">Create Tournament</h2>
              <div>
                <label className="block text-green-400 text-xs font-bold mb-1 tracking-widest uppercase">
                  Tournament Name
                </label>
                <input
                  value={tourneyName}
                  onChange={(e) => setTourneyName(e.target.value)}
                  required
                  className="w-full bg-black/40 border border-white/10 text-white rounded px-3 py-2 focus:outline-none focus:border-green-400"
                />
              </div>
              <div>
                <label className="block text-green-400 text-xs font-bold mb-1 tracking-widest uppercase">
                  Join Password
                </label>
                <div className="relative">
                  <input
                    type={showJoinPw ? "text" : "password"}
                    value={joinPassword}
                    onChange={(e) => setJoinPassword(e.target.value)}
                    placeholder="Players use this to join"
                    required
                    minLength={4}
                    className="w-full bg-black/40 border border-white/10 text-white placeholder-white/20 rounded px-3 py-2 pr-20 focus:outline-none focus:border-green-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowJoinPw(!showJoinPw)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-white/40 hover:text-white/70 px-2"
                  >
                    {showJoinPw ? "hide" : "show"}
                  </button>
                </div>
                <p className="text-white/30 text-xs mt-1">
                  Share this password with players so they can log in and compete in this tournament.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-green-400 text-xs font-bold mb-1 tracking-widest uppercase">
                    Start Time
                  </label>
                  <input
                    type="datetime-local"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                    className="w-full bg-black/40 border border-white/10 text-white rounded px-3 py-2 focus:outline-none focus:border-green-400"
                  />
                </div>
                <div>
                  <label className="block text-green-400 text-xs font-bold mb-1 tracking-widest uppercase">
                    End Time
                  </label>
                  <input
                    type="datetime-local"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    required
                    className="w-full bg-black/40 border border-white/10 text-white rounded px-3 py-2 focus:outline-none focus:border-green-400"
                  />
                </div>
              </div>
              {tourneyMsg && (
                <p className="text-green-400 text-sm bg-green-400/10 border border-green-500/30 rounded p-3">
                  ✓ {tourneyMsg}
                </p>
              )}
              {tourneyErr && <p className="text-red-400 text-sm">{tourneyErr}</p>}
              <button
                type="submit"
                className="w-full bg-green-500 hover:bg-green-400 text-black font-black py-2 rounded tracking-widest uppercase transition"
              >
                Create Tournament
              </button>
            </form>

            <div className="bg-white/5 border border-white/10 rounded-lg p-6">
              <h2 className="font-bold text-white/80 tracking-wider mb-4">All Tournaments</h2>
              {tournaments.length === 0 ? (
                <p className="text-white/30 text-sm">No tournaments created yet.</p>
              ) : (
                <div className="space-y-3">
                  {tournaments.map((t) => {
                    const start = new Date(t.startTime);
                    const end = new Date(t.endTime);
                    return (
                      <div key={t.id} className="bg-black/30 rounded px-4 py-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-bold text-white">{t.name}</p>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <TournamentStatus t={t} />
                            <button
                              onClick={() => deleteTournament(t.id, t.name)}
                              className="text-red-400 hover:text-red-300 text-xs border border-red-500/30 hover:border-red-400/50 px-2 py-0.5 rounded transition"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                        <p className="text-white/40 text-xs">
                          {start.toLocaleString()} → {end.toLocaleString()}
                        </p>
                        <div className="flex items-center gap-2 bg-black/40 rounded px-3 py-2">
                          <span className="text-white/40 text-xs uppercase tracking-widest">Join Password:</span>
                          <span className="text-yellow-300 text-sm font-mono flex-1">
                            {revealedPw[t.id] ? t.joinPassword : "••••••••"}
                          </span>
                          <button
                            onClick={() =>
                              setRevealedPw((prev) => ({ ...prev, [t.id]: !prev[t.id] }))
                            }
                            className="text-xs text-white/40 hover:text-white/70"
                          >
                            {revealedPw[t.id] ? "hide" : "reveal"}
                          </button>
                        </div>

                        <button
                          onClick={() => toggleLeaderboard(t.id)}
                          className="w-full text-left text-xs font-bold tracking-widest uppercase px-3 py-2 rounded border border-cyan-500/20 text-cyan-400/70 hover:text-cyan-400 hover:border-cyan-500/40 transition flex items-center justify-between"
                        >
                          <span>🏆 {expandedLb[t.id] ? "Hide" : "View"} Results</span>
                          <span>{expandedLb[t.id] ? "▲" : "▼"}</span>
                        </button>

                        {expandedLb[t.id] && (
                          <div className="bg-black/40 rounded border border-cyan-500/15 overflow-hidden">
                            {lbLoading[t.id] ? (
                              <p className="text-white/30 text-xs text-center py-4">Loading…</p>
                            ) : !lbData[t.id] || lbData[t.id].length === 0 ? (
                              <p className="text-white/25 text-xs text-center py-4">🧟 No scores recorded</p>
                            ) : (
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-white/10 text-white/30 uppercase tracking-widest">
                                    <th className="px-3 py-1.5 text-left">Rank</th>
                                    <th className="px-3 py-1.5 text-left">Player</th>
                                    <th className="px-3 py-1.5 text-right">Best Score</th>
                                    <th className="px-3 py-1.5 text-right">Games</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {lbData[t.id].map((e) => (
                                    <tr key={e.discordUsername} className="border-b border-white/5 hover:bg-white/5">
                                      <td className="px-3 py-1.5 font-black">
                                        {MEDAL[e.rank] ?? <span className="text-white/30">#{e.rank}</span>}
                                      </td>
                                      <td className={`px-3 py-1.5 font-bold ${e.rank <= 3 ? "text-white" : "text-white/60"}`}>
                                        {e.discordUsername}
                                      </td>
                                      <td className="px-3 py-1.5 text-right font-black text-yellow-400">{e.bestScore}</td>
                                      <td className="px-3 py-1.5 text-right text-white/30">{e.gamesPlayed}×</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "players" && (
          <div className="space-y-4">
            <div className="bg-white/5 border border-white/10 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-white/80 tracking-wider">
                  Players who have joined
                </h2>
                <button
                  onClick={loadData}
                  className="text-xs text-white/40 hover:text-white/70 border border-white/10 px-3 py-1 rounded"
                >
                  Refresh
                </button>
              </div>
              <p className="text-white/30 text-xs mb-4">
                Players are auto-added when they first log in with a tournament password.
              </p>
              {nonAdminUsers.length === 0 ? (
                <p className="text-white/30 text-sm">No players have joined yet.</p>
              ) : (
                <div className="space-y-2">
                  {nonAdminUsers.map((u) => (
                    <div key={u.id} className="flex items-center justify-between bg-black/30 rounded px-4 py-3">
                      <div>
                        <p className="font-bold text-white">{u.discordUsername}</p>
                        <p className="text-white/30 text-xs">
                          Joined {new Date(u.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={() => deleteUser(u.id, u.discordUsername)}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "settings" && (
          <div className="space-y-6">
            <form
              onSubmit={changePassword}
              className="bg-white/5 border border-white/10 rounded-lg p-6 space-y-4"
            >
              <h2 className="font-bold text-white/80 tracking-wider">Change Admin Password</h2>
              <div>
                <label className="block text-green-400 text-xs font-bold mb-1 tracking-widest uppercase">
                  Current Password
                </label>
                <input
                  type="password"
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full bg-black/40 border border-white/10 text-white placeholder-white/20 rounded px-3 py-2 focus:outline-none focus:border-green-400"
                />
              </div>
              <div>
                <label className="block text-green-400 text-xs font-bold mb-1 tracking-widest uppercase">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                  className="w-full bg-black/40 border border-white/10 text-white placeholder-white/20 rounded px-3 py-2 focus:outline-none focus:border-green-400"
                />
              </div>
              <div>
                <label className="block text-green-400 text-xs font-bold mb-1 tracking-widest uppercase">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                  className="w-full bg-black/40 border border-white/10 text-white placeholder-white/20 rounded px-3 py-2 focus:outline-none focus:border-green-400"
                />
              </div>
              {pwMsg && <p className="text-green-400 text-sm">{pwMsg}</p>}
              {pwErr && <p className="text-red-400 text-sm">{pwErr}</p>}
              <button
                type="submit"
                className="w-full bg-green-500 hover:bg-green-400 text-black font-black py-2 rounded tracking-widest uppercase transition"
              >
                Update Password
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
