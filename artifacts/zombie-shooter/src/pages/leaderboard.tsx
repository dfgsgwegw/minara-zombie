import { useEffect, useState, useCallback } from "react";
import { api, LeaderboardEntry, Tournament } from "@/lib/api";
import { getAuth } from "@/lib/auth";

interface Props {
  onBack: () => void;
}

function formatTimeLeft(endTime: string): string {
  const diff = new Date(endTime).getTime() - Date.now();
  if (diff <= 0) return "Ended";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${h}h ${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`;
}

export default function LeaderboardPage({ onBack }: Props) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [timeLeft, setTimeLeft] = useState("");
  const [loading, setLoading] = useState(true);
  const user = getAuth();

  const fetchLeaderboard = useCallback(async () => {
    try {
      const data = await api.leaderboard();
      setLeaderboard(data.leaderboard);
      setTournament(data.tournament);
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 10000);
    return () => clearInterval(interval);
  }, [fetchLeaderboard]);

  useEffect(() => {
    if (!tournament) return;
    const tick = () => setTimeLeft(formatTimeLeft(tournament.endTime));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [tournament]);

  const rankColors: Record<number, string> = {
    1: "text-yellow-400",
    2: "text-gray-300",
    3: "text-orange-400",
  };

  const rankEmojis: Record<number, string> = {
    1: "🥇",
    2: "🥈",
    3: "🥉",
  };

  return (
    <div
      className="min-h-screen bg-black text-white flex flex-col"
      style={{ backgroundImage: "url('/assets/background.png')", backgroundSize: "cover", backgroundPosition: "center" }}
    >
      <div className="absolute inset-0 bg-black/80" />
      <div className="relative z-10 flex flex-col min-h-screen p-4 max-w-2xl mx-auto w-full">
        <div className="flex items-center justify-between mb-6 pt-4">
          <button
            onClick={onBack}
            className="text-green-400 hover:text-green-300 text-sm tracking-widest uppercase border border-green-500/30 px-4 py-2 rounded hover:border-green-400 transition"
          >
            ← Back
          </button>
          <h1 className="text-2xl font-black text-green-400 tracking-widest">LEADERBOARD</h1>
          <div className="w-24" />
        </div>

        {tournament && (
          <div className="bg-black/60 border border-green-500/30 rounded-lg p-4 mb-6 text-center">
            <p className="text-green-400 font-bold tracking-wider">{tournament.name}</p>
            <p className="text-white/60 text-sm mt-1">
              {new Date(tournament.endTime) > new Date()
                ? `Time remaining: `
                : "Tournament ended · "}
              <span className="text-white font-mono">{timeLeft}</span>
            </p>
          </div>
        )}

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-green-400/60">
            Loading...
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-white/40 text-center">
            <div>
              <p className="text-4xl mb-4">🧟</p>
              <p>No scores yet. Be the first to play!</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {leaderboard.map((entry) => {
              const isMe = entry.discordUsername === user?.discordUsername;
              return (
                <div
                  key={entry.discordUsername}
                  className={`flex items-center gap-4 p-4 rounded-lg border transition ${
                    isMe
                      ? "border-green-400/60 bg-green-900/20"
                      : "border-white/10 bg-black/40"
                  }`}
                >
                  <div className={`text-2xl font-black w-10 text-center ${rankColors[entry.rank] ?? "text-white/60"}`}>
                    {rankEmojis[entry.rank] ?? `#${entry.rank}`}
                  </div>
                  <div className="flex-1">
                    <p className={`font-bold ${isMe ? "text-green-400" : "text-white"}`}>
                      {entry.discordUsername}
                      {isMe && <span className="ml-2 text-xs text-green-500/70">(you)</span>}
                    </p>
                    <p className="text-white/40 text-xs mt-0.5">
                      {entry.gamesPlayed} game{entry.gamesPlayed !== 1 ? "s" : ""} played
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-yellow-400">{entry.bestScore}</p>
                    <p className="text-white/40 text-xs">best score</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-center text-white/20 text-xs mt-6 pb-4">
          Refreshes every 10 seconds
        </p>
      </div>
    </div>
  );
}
