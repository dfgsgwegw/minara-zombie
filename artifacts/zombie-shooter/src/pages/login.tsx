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
    <div className="min-h-screen flex" style={{ background: "#EDE8DC", fontFamily: "'Inter', sans-serif" }}>
      {/* Left — form */}
      <div className="flex flex-col items-start justify-center px-8 sm:px-16 py-12 flex-1 max-w-lg">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-12">
          <img src="/assets/minara-mascot.png" alt="Minara" className="w-8 h-8 object-contain" />
          <span className="font-black text-xl tracking-wide" style={{ fontFamily: "'Playfair Display', serif", color: "#1C1A18" }}>MINARA</span>
        </div>

        <p className="text-xs font-bold tracking-[0.3em] mb-3" style={{ color: "#C8C3BA" }}>
          {adminMode ? "ADMINISTRATOR" : "TOURNAMENT"}
        </p>
        <h1 className="font-black leading-none mb-2" style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(2.2rem, 5vw, 3rem)", color: "#1C1A18" }}>
          {adminMode ? "Admin\nAccess" : "Join the\nDefense"}
        </h1>
        <p className="text-sm mb-8" style={{ color: "#C8C3BA" }}>
          {adminMode
            ? "Sign in to manage tournaments and players."
            : "Enter your Discord username and the tournament password to compete."}
        </p>

        <form onSubmit={handleSubmit} className="w-full space-y-4">
          {adminMode && (
            <div className="mb-2 text-center">
              <span className="text-xs font-bold bg-yellow-100 text-yellow-700 border border-yellow-300 px-3 py-1 rounded-full tracking-widest">
                🔐 ADMINISTRATOR LOGIN
              </span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold mb-1.5 tracking-widest uppercase" style={{ color: "#1C1A18" }}>
              Discord Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={adminMode ? "admin" : "YourDiscordName"}
              required
              autoComplete="username"
              className="w-full rounded-lg px-4 py-3 text-sm focus:outline-none transition"
              style={{ border: "1.5px solid #1C1A18", background: "#FFFFFF", color: "#1C1A18" }}
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1.5 tracking-widest uppercase" style={{ color: "#1C1A18" }}>
              {adminMode ? "Password" : "Tournament Password"}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              className="w-full rounded-lg px-4 py-3 text-sm focus:outline-none transition"
              style={{ border: "1.5px solid #1C1A18", background: "#FFFFFF", color: "#1C1A18" }}
            />
            {!adminMode && (
              <p className="text-xs mt-1" style={{ color: "#C8C3BA" }}>
                The password is specific to each tournament
              </p>
            )}
          </div>

          {error && (
            <div className="text-red-600 text-sm text-center bg-red-50 border border-red-300 rounded-lg p-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full font-black py-3 rounded-lg text-sm tracking-widest uppercase transition-all disabled:opacity-50"
            style={{ background: "#1C1A18", color: "#EDE8DC" }}
          >
            {loading ? "Logging in..." : adminMode ? "Access Admin Panel" : "Join Tournament →"}
          </button>
        </form>
      </div>

      {/* Right — mascot panel */}
      <div className="hidden sm:flex flex-1 items-end justify-center overflow-hidden relative"
        style={{ background: "#E8E2D6", borderLeft: "1.5px solid #C8C3BA" }}>
        <div className="absolute top-12 left-8">
          <p className="font-black leading-tight" style={{ fontFamily: "'Playfair Display', serif", fontSize: "2.5rem", color: "#1C1A18" }}>
            Defend the<br /><em>AI frontier.</em>
          </p>
          <p className="text-sm mt-3" style={{ color: "#C8C3BA" }}>Shoot the corrupted bots.<br />Climb the leaderboard.</p>
        </div>
        <img
          src="/assets/minara-mascot.png"
          alt="Minara mascot"
          className="object-contain object-bottom select-none"
          style={{ maxHeight: "75%", width: "auto", opacity: 0.9 }}
        />
      </div>
    </div>
  );
}
