import { useEffect, useState } from "react";
import { api, AdminUser, Tournament } from "@/lib/api";

interface Props {
  onBack: () => void;
}

function formatLocal(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function AdminPage({ onBack }: Props) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [tab, setTab] = useState<"users" | "tournament">("users");

  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [userMsg, setUserMsg] = useState("");
  const [userErr, setUserErr] = useState("");

  const now = new Date();
  const [tourneyName, setTourneyName] = useState("Zombie Shooter Tournament");
  const [startTime, setStartTime] = useState(formatLocal(now));
  const [endTime, setEndTime] = useState(
    formatLocal(new Date(now.getTime() + 4 * 3600 * 1000)),
  );
  const [tourneyMsg, setTourneyMsg] = useState("");
  const [tourneyErr, setTourneyErr] = useState("");

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

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setUserMsg("");
    setUserErr("");
    try {
      await api.admin.createUser(newUsername.trim(), newPassword, newIsAdmin);
      setUserMsg(`User "${newUsername.trim()}" created!`);
      setNewUsername("");
      setNewPassword("");
      setNewIsAdmin(false);
      loadData();
    } catch (err: unknown) {
      setUserErr(err instanceof Error ? err.message : "Failed");
    }
  }

  async function deleteUser(id: number, name: string) {
    if (!confirm(`Delete ${name}?`)) return;
    await api.admin.deleteUser(id);
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
      );
      setTourneyMsg("Tournament created!");
      loadData();
    } catch (err: unknown) {
      setTourneyErr(err instanceof Error ? err.message : "Failed");
    }
  }

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
          {(["users", "tournament"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-6 py-3 font-bold tracking-widest uppercase text-sm transition ${
                tab === t
                  ? "border-b-2 border-green-400 text-green-400"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "users" && (
          <div className="space-y-6">
            <form
              onSubmit={createUser}
              className="bg-white/5 border border-white/10 rounded-lg p-6 space-y-4"
            >
              <h2 className="font-bold text-white/80 tracking-wider">Add Player</h2>
              <div>
                <label className="block text-green-400 text-xs font-bold mb-1 tracking-widest uppercase">
                  Discord Username
                </label>
                <input
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="PlayerName#1234"
                  required
                  className="w-full bg-black/40 border border-white/10 text-white placeholder-white/20 rounded px-3 py-2 focus:outline-none focus:border-green-400"
                />
              </div>
              <div>
                <label className="block text-green-400 text-xs font-bold mb-1 tracking-widest uppercase">
                  Password
                </label>
                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Set a password for this player"
                  required
                  className="w-full bg-black/40 border border-white/10 text-white placeholder-white/20 rounded px-3 py-2 focus:outline-none focus:border-green-400"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isAdmin"
                  checked={newIsAdmin}
                  onChange={(e) => setNewIsAdmin(e.target.checked)}
                  className="accent-green-400"
                />
                <label htmlFor="isAdmin" className="text-white/60 text-sm">Admin privileges</label>
              </div>
              {userMsg && <p className="text-green-400 text-sm">{userMsg}</p>}
              {userErr && <p className="text-red-400 text-sm">{userErr}</p>}
              <button
                type="submit"
                className="w-full bg-green-500 hover:bg-green-400 text-black font-black py-2 rounded tracking-widest uppercase transition"
              >
                Add Player
              </button>
            </form>

            <div className="bg-white/5 border border-white/10 rounded-lg p-6">
              <h2 className="font-bold text-white/80 tracking-wider mb-4">
                Players ({users.length})
              </h2>
              {users.length === 0 ? (
                <p className="text-white/30 text-sm">No players yet.</p>
              ) : (
                <div className="space-y-2">
                  {users.map((u) => (
                    <div key={u.id} className="flex items-center justify-between bg-black/30 rounded px-4 py-3">
                      <div>
                        <p className="font-bold text-white">
                          {u.discordUsername}
                          {u.isAdmin && (
                            <span className="ml-2 text-xs text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded">
                              admin
                            </span>
                          )}
                        </p>
                        <p className="text-white/30 text-xs">
                          Added {new Date(u.createdAt).toLocaleDateString()}
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
              {tourneyMsg && <p className="text-green-400 text-sm">{tourneyMsg}</p>}
              {tourneyErr && <p className="text-red-400 text-sm">{tourneyErr}</p>}
              <button
                type="submit"
                className="w-full bg-green-500 hover:bg-green-400 text-black font-black py-2 rounded tracking-widest uppercase transition"
              >
                Create Tournament
              </button>
            </form>

            <div className="bg-white/5 border border-white/10 rounded-lg p-6">
              <h2 className="font-bold text-white/80 tracking-wider mb-4">Tournaments</h2>
              {tournaments.length === 0 ? (
                <p className="text-white/30 text-sm">No tournaments created yet.</p>
              ) : (
                <div className="space-y-2">
                  {tournaments.map((t) => {
                    const now2 = new Date();
                    const start = new Date(t.startTime);
                    const end = new Date(t.endTime);
                    const active = start <= now2 && end >= now2;
                    const upcoming = start > now2;
                    return (
                      <div key={t.id} className="bg-black/30 rounded px-4 py-3">
                        <div className="flex items-start justify-between">
                          <p className="font-bold text-white">{t.name}</p>
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
                        </div>
                        <p className="text-white/40 text-xs mt-1">
                          {start.toLocaleString()} → {end.toLocaleString()}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
