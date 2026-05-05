import { useState } from "react";
import { api } from "@/lib/api";
import { saveAuth } from "@/lib/auth";

interface Props {
  onLogin: () => void;
  adminMode?: boolean;
}

export default function LoginPage({ onLogin, adminMode = false }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.login(username.trim(), password);
      saveAuth(res.token, {
        discordUsername: res.discordUsername,
        isAdmin: res.isAdmin,
      });
      onLogin();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen bg-black flex flex-col items-center justify-center p-4"
      style={{
        backgroundImage: "url('/assets/background.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="absolute inset-0 bg-black/70" />
      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black tracking-widest drop-shadow-[0_0_20px_rgba(192,132,252,0.8)] mb-1"
            style={{ color: "#c084fc" }}>
            MINARA AI
          </h1>
          <h2 className="text-3xl font-black text-white tracking-widest">ZOMBIE DEFENDER</h2>
          <p className="mt-2 tracking-wider text-sm" style={{ color: "rgba(192,132,252,0.7)" }}>
            {adminMode ? "ADMIN ACCESS" : "TOURNAMENT"}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-black/80 rounded-lg p-8"
          style={{ border: "1px solid rgba(192,132,252,0.3)", boxShadow: "0 0 40px rgba(192,132,252,0.15)" }}
        >
          {adminMode && (
            <div className="mb-5 text-center">
              <span className="text-xs font-bold text-yellow-400 bg-yellow-400/10 border border-yellow-500/30 px-3 py-1 rounded-full tracking-widest">
                🔐 ADMINISTRATOR LOGIN
              </span>
            </div>
          )}

          {!adminMode && (
            <div className="mb-5 p-3 rounded text-center" style={{ background: "rgba(192,132,252,0.1)", border: "1px solid rgba(192,132,252,0.2)" }}>
              <p className="text-xs tracking-wide" style={{ color: "rgba(192,132,252,0.9)" }}>
                Enter your Discord username and the tournament password provided by the organiser
              </p>
            </div>
          )}

          <div className="mb-5">
            <label className="block text-sm font-bold mb-2 tracking-widest uppercase" style={{ color: "#c084fc" }}>
              Discord Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={adminMode ? "admin" : "YourDiscordName"}
              required
              autoComplete="username"
              className="w-full bg-black/60 text-white rounded px-4 py-3 focus:outline-none transition"
              style={{ border: "1px solid rgba(192,132,252,0.4)", caretColor: "#c084fc" }}
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-bold mb-2 tracking-widest uppercase" style={{ color: "#c084fc" }}>
              {adminMode ? "Password" : "Tournament Password"}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              className="w-full bg-black/60 text-white rounded px-4 py-3 focus:outline-none transition"
              style={{ border: "1px solid rgba(192,132,252,0.4)", caretColor: "#c084fc" }}
            />
            {!adminMode && (
              <p className="text-white/30 text-xs mt-1">
                The password is specific to each tournament
              </p>
            )}
          </div>

          {error && (
            <div className="mb-4 text-red-400 text-sm text-center bg-red-900/20 border border-red-500/30 rounded p-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full disabled:opacity-50 text-black font-black py-3 rounded tracking-widest text-lg transition-all uppercase"
            style={{ background: "linear-gradient(135deg, #c084fc, #a855f7)", boxShadow: loading ? "none" : "0 0 20px rgba(192,132,252,0.4)" }}
          >
            {loading ? "Logging in..." : adminMode ? "Access Admin Panel" : "Join Tournament"}
          </button>
        </form>
      </div>
    </div>
  );
}
