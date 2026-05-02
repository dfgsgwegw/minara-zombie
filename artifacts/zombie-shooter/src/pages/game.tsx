import { useEffect, useRef, useState, useCallback } from "react";
import { api, Tournament, LeaderboardEntry } from "@/lib/api";
import { getAuth, clearAuth, saveAuth } from "@/lib/auth";
import { detectDevTools } from "@/lib/anticheats";

interface Props { onLogout: () => void; loggedIn?: boolean; onLogin?: () => void; }

type GameState = "menu" | "playing" | "over";
type PlayMode = "tournament" | "demo" | null;

interface Bullet { x: number; y: number; vy: number }
interface Zombie { x: number; y: number; w: number; h: number; speed: number; hp: number; flash: number }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; r: number; color: string }
interface Bubble { x: number; y: number; r: number; vy: number; alpha: number }

const CW = 780;
const CH = 560;

/* ── Audio ─────────────────────────────────────────────────────── */
let audioCtx: AudioContext | null = null;
function getAudioCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function playMagicShot() {
  try {
    const ctx = getAudioCtx();
    const t = ctx.currentTime;
    // Magical whoosh + sparkle
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1200, t);
    filter.frequency.exponentialRampToValueAtTime(400, t + 0.18);
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(220, t + 0.18);
    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.18);
    // sparkle ping
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(2200, t);
    osc2.frequency.exponentialRampToValueAtTime(1100, t + 0.08);
    gain2.gain.setValueAtTime(0.15, t);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(t);
    osc2.stop(t + 0.08);
  } catch {}
}

function playZombieHit() {
  try {
    const ctx = getAudioCtx();
    const t = ctx.currentTime;
    // Wet slime splat
    const bufferSize = ctx.sampleRate * 0.12;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(600, t);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(t);
  } catch {}
}

function playZombieMoan() {
  try {
    const ctx = getAudioCtx();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    const base = 80 + Math.random() * 40;
    osc.frequency.setValueAtTime(base, t);
    osc.frequency.setValueAtTime(base * 0.85, t + 0.15);
    osc.frequency.setValueAtTime(base * 1.1, t + 0.3);
    gain.gain.setValueAtTime(0.0, t);
    gain.gain.linearRampToValueAtTime(0.18, t + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.55);
  } catch {}
}

function playDamage() {
  try {
    const ctx = getAudioCtx();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.25);
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.25);
  } catch {}
}

/* ── Timer ─────────────────────────────────────────────────────── */
function fmt(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1_000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/* ── Leaderboard ────────────────────────────────────────────────── */
const RANK_MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };
const RANK_COLOR: Record<number, string> = { 1: "text-yellow-400", 2: "text-gray-300", 3: "text-orange-400" };

function LiveLeaderboard({ entries, myUsername, tournament }: {
  entries: LeaderboardEntry[]; myUsername: string; tournament: Tournament | null;
}) {
  const [timeLeft, setTimeLeft] = useState("");
  useEffect(() => {
    if (!tournament) return;
    const tick = () => setTimeLeft(fmt(Math.max(0, new Date(tournament.endTime).getTime() - Date.now())));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [tournament]);

  return (
    <div className="flex flex-col h-full overflow-hidden rounded-lg border border-cyan-500/20" style={{ background: "rgba(0,20,30,0.88)" }}>
      <div className="px-3 py-2 border-b border-cyan-500/20 flex-shrink-0" style={{ background: "rgba(0,60,80,0.5)" }}>
        <p className="text-cyan-400 font-black tracking-widest text-xs uppercase">🌊 Leaderboard</p>
        {tournament && <p className="text-white/40 text-xs font-mono mt-0.5 truncate">{timeLeft} left</p>}
      </div>
      <div className="flex-1 overflow-y-auto">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-white/20 text-xs text-center px-3 py-8">
            <span className="text-2xl mb-2">🧟</span>No scores yet
          </div>
        ) : entries.map((e) => {
          const isMe = e.discordUsername === myUsername;
          return (
            <div key={e.discordUsername}
              className={`flex items-center gap-2 px-3 py-2 border-b border-white/5 ${isMe ? "bg-cyan-900/25" : ""}`}>
              <span className={`text-sm w-6 text-center flex-shrink-0 font-black ${RANK_COLOR[e.rank] ?? "text-white/40"}`}>
                {RANK_MEDAL[e.rank] ?? `#${e.rank}`}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-bold truncate ${isMe ? "text-cyan-400" : "text-white/80"}`}>
                  {e.discordUsername}{isMe && <span className="text-cyan-600 ml-1">←</span>}
                </p>
                <p className="text-white/30 text-[10px]">{e.gamesPlayed}× played</p>
              </div>
              <span className="text-yellow-400 font-black text-sm flex-shrink-0">{e.bestScore}</span>
            </div>
          );
        })}
      </div>
      <div className="px-3 py-1.5 border-t border-white/5 flex-shrink-0">
        <p className="text-white/20 text-[10px] text-center">Refreshes every 10s</p>
      </div>
    </div>
  );
}

/* ── Main Game Page ─────────────────────────────────────────────── */
export default function GamePage({ onLogout, loggedIn = true, onLogin }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>("menu");
  const [score, setScore] = useState(0);
  const [health, setHealth] = useState(100);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [tournamentStatus, setTournamentStatus] = useState<"active" | "upcoming" | "none">("none");
  const [timeLeft, setTimeLeft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  // Sidebar login form state (used when not logged in)
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [devtoolsWarning, setDevtoolsWarning] = useState(false);
  const [playMode, setPlayMode] = useState<PlayMode>(null);

  const sessionTokenRef = useRef<string | null>(null);

  const gs = useRef({
    shooter: { x: CW / 2 - 48, y: CH - 110, w: 96, h: 96, speed: 25 },
    bullets: [] as Bullet[],
    zombies: [] as Zombie[],
    particles: [] as Particle[],
    bubbles: [] as Bubble[],
    keys: { a: false, d: false, left: false, right: false },
    pts: 0,
    hp: 100,
    dead: false,
    animId: 0,
    frame: 0,
    lastShot: 0,
    diffMult: 1,
    screenShake: 0,
    lastDir: 1 as 1 | -1,
    lastFrameTime: 0,
  });

  const shooterImg = useRef(new Image());
  const zombieImg = useRef(new Image());
  const bgImg = useRef(new Image());

  const fetchTournament = useCallback(async () => {
    try { const d = await api.currentTournament(); setTournamentStatus(d.status); setTournament(d.tournament); } catch {}
  }, []);

  const fetchLeaderboard = useCallback(async () => {
    try { const d = await api.leaderboard(); setLeaderboard(d.leaderboard); } catch {}
  }, []);

  useEffect(() => {
    shooterImg.current.src = "/assets/shooter.png";
    zombieImg.current.src = "/assets/zombie.png";
    bgImg.current.src = "/assets/background.png";

    // init background bubbles
    const s = gs.current;
    for (let i = 0; i < 18; i++) {
      s.bubbles.push({
        x: Math.random() * CW, y: Math.random() * CH,
        r: 2 + Math.random() * 5, vy: 0.3 + Math.random() * 0.6,
        alpha: 0.1 + Math.random() * 0.25,
      });
    }

    fetchTournament(); fetchLeaderboard();
    const lb = setInterval(fetchLeaderboard, 10_000);
    const tr = setInterval(fetchTournament, 30_000);
    const stopDetect = detectDevTools(() => {
      setDevtoolsWarning(true);
      gs.current.dead = true;
      cancelAnimationFrame(gs.current.animId);
      setGameState((prev) => prev === "playing" ? "over" : prev);
      setScore(gs.current.pts);
      sessionTokenRef.current = null;
    });
    return () => { clearInterval(lb); clearInterval(tr); stopDetect(); };
  }, [fetchTournament, fetchLeaderboard]);

  useEffect(() => {
    if (!tournament) return;
    const tick = () => setTimeLeft(fmt(Math.max(0, new Date(tournament.endTime).getTime() - Date.now())));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [tournament]);

  async function startGame() {
    try { const { sessionToken } = await api.startSession(); sessionTokenRef.current = sessionToken; } catch { return; }
    const s = gs.current;
    s.shooter = { x: CW / 2 - 48, y: CH - 110, w: 96, h: 96, speed: 25 };
    s.bullets = []; s.zombies = []; s.particles = [];
    s.keys = { a: false, d: false, left: false, right: false };
    s.pts = 0; s.hp = 100; s.dead = false; s.frame = 0; s.diffMult = 1; s.screenShake = 0; s.lastShot = 0; s.lastFrameTime = 0;
    setScore(0); setHealth(100);
    setSubmitted(false); setSubmitError(""); setDevtoolsWarning(false);
    setPlayMode("tournament");
    setGameState("playing");
    requestAnimationFrame(loop);
  }

  function startDemoGame() {
    sessionTokenRef.current = null;
    const s = gs.current;
    s.shooter = { x: CW / 2 - 48, y: CH - 110, w: 96, h: 96, speed: 25 };
    s.bullets = []; s.zombies = []; s.particles = [];
    s.keys = { a: false, d: false, left: false, right: false };
    s.pts = 0; s.hp = 100; s.dead = false; s.frame = 0; s.diffMult = 1; s.screenShake = 0; s.lastShot = 0; s.lastFrameTime = 0;
    setScore(0); setHealth(100);
    setSubmitted(false); setSubmitError(""); setDevtoolsWarning(false);
    setPlayMode("demo");
    setGameState("playing");
    requestAnimationFrame(loop);
  }

  function spawnParticles(x: number, y: number) {
    const s = gs.current;
    const colors = ["#4ade80", "#22c55e", "#86efac", "#bbf7d0", "#a3e635"];
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12 + Math.random() * 0.5;
      const speed = 2 + Math.random() * 4;
      s.particles.push({
        x, y,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life: 1, maxLife: 1,
        r: 3 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
  }

  function drawBullet(ctx: CanvasRenderingContext2D, b: Bullet) {
    const grad = ctx.createRadialGradient(b.x + 3, b.y + 6, 0, b.x + 3, b.y + 6, 10);
    grad.addColorStop(0, "rgba(255,180,255,1)");
    grad.addColorStop(0.4, "rgba(200,80,255,0.8)");
    grad.addColorStop(1, "rgba(100,0,200,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(b.x + 3, b.y + 6, 10, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.ellipse(b.x + 3, b.y + 4, 3, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawHud(ctx: CanvasRenderingContext2D, pts: number, hp: number) {
    // Score box
    ctx.fillStyle = "rgba(0,10,20,0.7)";
    ctx.beginPath();
    ctx.roundRect(8, 8, 180, 62, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,200,255,0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = "bold 14px 'monospace'";
    ctx.fillStyle = "rgba(0,200,255,0.9)";
    ctx.fillText("SCORE", 18, 28);
    ctx.font = "bold 22px 'monospace'";
    ctx.fillStyle = "#fbbf24";
    ctx.fillText(String(pts), 18, 52);

    // Health bar
    ctx.fillStyle = "rgba(0,10,20,0.7)";
    ctx.beginPath();
    ctx.roundRect(CW - 188, 8, 180, 62, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,200,255,0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.font = "bold 12px monospace";
    ctx.fillStyle = "rgba(0,200,255,0.9)";
    ctx.fillText("HEALTH", CW - 178, 26);
    const barW = 154;
    const barFill = (hp / 100) * barW;
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.beginPath(); ctx.roundRect(CW - 178, 34, barW, 16, 4); ctx.fill();
    const hc = hp > 60 ? "#4ade80" : hp > 30 ? "#facc15" : "#ef4444";
    ctx.fillStyle = hc;
    if (barFill > 0) { ctx.beginPath(); ctx.roundRect(CW - 178, 34, barFill, 16, 4); ctx.fill(); }
    ctx.font = "bold 11px monospace";
    ctx.fillStyle = "white";
    ctx.fillText(`${hp}%`, CW - 178 + barW / 2 - 14, 47);
  }

  function loop(now: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const s = gs.current;
    if (s.dead) { setGameState("over"); setScore(s.pts); return; }

    // Delta time: scale all movement by elapsed time so speed is frame-rate independent
    const dt = s.lastFrameTime === 0 ? 1 : Math.min((now - s.lastFrameTime) / 16.667, 3);
    s.lastFrameTime = now;

    s.frame++;
    // Increase difficulty every 30s (based on real time via frame count at 60fps)
    s.diffMult = 1 + Math.floor(s.frame / 1800) * 0.25;

    // Screen shake
    let shakeX = 0, shakeY = 0;
    if (s.screenShake > 0) {
      shakeX = (Math.random() - 0.5) * s.screenShake * 6;
      shakeY = (Math.random() - 0.5) * s.screenShake * 6;
      s.screenShake -= 0.8 * dt;
      if (s.screenShake < 0) s.screenShake = 0;
    }
    ctx.save();
    ctx.translate(shakeX, shakeY);

    // Background
    ctx.drawImage(bgImg.current, 0, 0, CW, CH);

    // Underwater overlay tint
    ctx.fillStyle = "rgba(0,30,60,0.18)";
    ctx.fillRect(0, 0, CW, CH);

    // Bubbles
    for (const b of s.bubbles) {
      b.y -= b.vy * dt;
      if (b.y < -10) b.y = CH + 10;
      ctx.strokeStyle = `rgba(100,220,255,${b.alpha})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Shooter movement (arrow keys OR A/D)
    const movingLeft = s.keys.a || s.keys.left;
    const movingRight = s.keys.d || s.keys.right;
    if (movingLeft && s.shooter.x > 0) { s.shooter.x -= s.shooter.speed * dt; s.lastDir = -1; }
    if (movingRight && s.shooter.x < CW - s.shooter.w) { s.shooter.x += s.shooter.speed * dt; s.lastDir = 1; }

    // Zombies
    const spawnChance = 0.095 + s.diffMult * 0.030;
    if (Math.random() < spawnChance) {
      const sz = 72 + Math.random() * 20;
      const speed = (7.0 + Math.random() * 4.5) * s.diffMult;
      s.zombies.push({ x: Math.random() * (CW - sz), y: -sz, w: sz, h: sz, speed, hp: 1, flash: 0 });
      if (Math.random() < 0.3) playZombieMoan();
    }

    for (let i = s.zombies.length - 1; i >= 0; i--) {
      s.zombies[i].y += s.zombies[i].speed * dt;
      if (s.zombies[i].flash > 0) {
        ctx.globalAlpha = 0.5;
        ctx.drawImage(zombieImg.current, s.zombies[i].x, s.zombies[i].y, s.zombies[i].w, s.zombies[i].h);
        ctx.globalAlpha = 1;
        s.zombies[i].flash--;
      } else {
        ctx.drawImage(zombieImg.current, s.zombies[i].x, s.zombies[i].y, s.zombies[i].w, s.zombies[i].h);
      }
      if (s.zombies[i].y > CH + 10) s.zombies.splice(i, 1);
    }

    // Bullets
    for (let i = s.bullets.length - 1; i >= 0; i--) {
      s.bullets[i].y += s.bullets[i].vy * dt;
      drawBullet(ctx, s.bullets[i]);
      if (s.bullets[i].y < -20) s.bullets.splice(i, 1);
    }

    // Collision: bullets vs zombies
    outer: for (let bi = s.bullets.length - 1; bi >= 0; bi--) {
      for (let zi = s.zombies.length - 1; zi >= 0; zi--) {
        const b = s.bullets[bi]; const z = s.zombies[zi];
        if (b && z && b.x > z.x - 8 && b.x < z.x + z.w + 8 && b.y > z.y && b.y < z.y + z.h) {
          spawnParticles(b.x, b.y);
          playZombieHit();
          s.zombies.splice(zi, 1);
          s.bullets.splice(bi, 1);
          s.pts += 10;
          setScore(s.pts);
          continue outer;
        }
      }
    }

    // Collision: zombies vs shooter
    for (let zi = s.zombies.length - 1; zi >= 0; zi--) {
      const z = s.zombies[zi];
      const sh = s.shooter;
      const hitboxPad = 14;
      if (z.x + hitboxPad < sh.x + sh.w - hitboxPad &&
          z.x + z.w - hitboxPad > sh.x + hitboxPad &&
          z.y + hitboxPad < sh.y + sh.h &&
          z.y + z.h - hitboxPad > sh.y + hitboxPad) {
        s.zombies.splice(zi, 1);
        s.hp -= 20;
        s.screenShake = 4;
        setHealth(s.hp);
        playDamage();
      }
    }

    // Particles
    for (let i = s.particles.length - 1; i >= 0; i--) {
      const p = s.particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += 0.12 * dt;
      p.life -= 0.05 * dt;
      if (p.life <= 0) { s.particles.splice(i, 1); continue; }
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Shooter — back-view sprite faces upward naturally; flip for left/right lean
    {
      const sh = s.shooter;
      const dir = s.lastDir;
      ctx.save();
      if (dir === -1) {
        ctx.translate(sh.x + sh.w, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(shooterImg.current, 0, sh.y, sh.w, sh.h);
      } else {
        ctx.drawImage(shooterImg.current, sh.x, sh.y, sh.w, sh.h);
      }
      ctx.restore();

      // Magic staff glow flash when shooting
      if (performance.now() - s.lastShot < 120) {
        const flashX = dir === 1 ? sh.x + sh.w * 0.72 : sh.x + sh.w * 0.28;
        const flashY = sh.y + sh.h * 0.1;
        ctx.save();
        ctx.globalAlpha = 0.9;
        const flash = ctx.createRadialGradient(flashX, flashY, 0, flashX, flashY, 20);
        flash.addColorStop(0, "rgba(255,180,255,1)");
        flash.addColorStop(0.5, "rgba(200,80,255,0.7)");
        flash.addColorStop(1, "rgba(120,0,200,0)");
        ctx.fillStyle = flash;
        ctx.beginPath();
        ctx.arc(flashX, flashY, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // HUD
    drawHud(ctx, s.pts, s.hp);

    // Difficulty indicator
    if (s.diffMult > 1) {
      ctx.font = "bold 11px monospace";
      ctx.fillStyle = `rgba(255,${Math.max(0,220-s.diffMult*40)},50,0.8)`;
      ctx.fillText(`⚡ LEVEL ${Math.floor(s.diffMult / 0.25) - 2}`, CW / 2 - 28, 22);
    }

    // Demo mode badge
    if (playMode === "demo") {
      ctx.fillStyle = "rgba(0,10,20,0.65)";
      ctx.beginPath();
      ctx.roundRect(CW / 2 - 44, CH - 28, 88, 20, 5);
      ctx.fill();
      ctx.font = "bold 11px monospace";
      ctx.fillStyle = "rgba(0,200,255,0.55)";
      ctx.textAlign = "center";
      ctx.fillText("🎮 DEMO MODE", CW / 2, CH - 14);
      ctx.textAlign = "left";
    }

    ctx.restore();

    if (s.hp <= 0) { s.dead = true; setScore(s.pts); setGameState("over"); return; }
    s.animId = requestAnimationFrame(loop);
  }

  useEffect(() => {
    const dn = (e: KeyboardEvent) => {
      if (e.key === "a" || e.key === "A") gs.current.keys.a = true;
      if (e.key === "d" || e.key === "D") gs.current.keys.d = true;
      if (e.key === "ArrowLeft") { gs.current.keys.left = true; e.preventDefault(); }
      if (e.key === "ArrowRight") { gs.current.keys.right = true; e.preventDefault(); }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "a" || e.key === "A") gs.current.keys.a = false;
      if (e.key === "d" || e.key === "D") gs.current.keys.d = false;
      if (e.key === "ArrowLeft") gs.current.keys.left = false;
      if (e.key === "ArrowRight") gs.current.keys.right = false;
    };
    window.addEventListener("keydown", dn);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", dn); window.removeEventListener("keyup", up); };
  }, []);

  function handleCanvasClick() {
    if (gameState !== "playing") return;
    const s = gs.current;
    const now = performance.now();
    if (now - s.lastShot < 120) return; // 120ms fire cooldown for smooth UX
    s.lastShot = now;
    s.bullets.push({ x: s.shooter.x + s.shooter.w / 2 - 3, y: s.shooter.y + 10, vy: -14 });
    playMagicShot();
  }

  // Mobile touch movement
  function handleTouchStart(e: React.TouchEvent<HTMLCanvasElement>) {
    if (gameState !== "playing") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const touchX = (e.touches[0].clientX - rect.left) / rect.width * CW;
    const s = gs.current;
    if (touchX < CW / 2) { s.keys.left = true; s.keys.right = false; }
    else { s.keys.right = true; s.keys.left = false; }
    handleCanvasClick();
  }

  function handleTouchEnd() {
    gs.current.keys.left = false; gs.current.keys.right = false;
  }

  async function handleSidebarLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);
    try {
      const res = await api.login(loginUsername.trim(), loginPassword);
      saveAuth(res.token, { discordUsername: res.discordUsername, isAdmin: res.isAdmin });
      onLogin?.();
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoginLoading(false);
    }
  }

  async function submitScore() {
    const token = sessionTokenRef.current;
    if (!token) { setSubmitError("No valid session."); return; }
    setSubmitting(true); setSubmitError("");
    try {
      await api.submitScore(gs.current.pts, token);
      sessionTokenRef.current = null;
      setSubmitted(true);
      fetchLeaderboard();
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Failed to submit score");
    }
    setSubmitting(false);
  }

  const user = getAuth();
  const canPlay = tournamentStatus === "active";

  const overlayBg: React.CSSProperties = {
    backgroundImage: "url('/assets/background.png')",
    backgroundSize: "cover",
    backgroundPosition: "center",
  };

  return (
    <div className="flex flex-col bg-black text-white overflow-hidden" style={{ height: "100dvh", userSelect: "none" }}>

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b flex-shrink-0 gap-2"
        style={{ borderColor: "rgba(0,200,255,0.12)", background: "rgba(0,10,20,0.95)" }}>
        <span className="text-cyan-400 font-bold text-xs truncate min-w-0">
          {loggedIn ? user?.discordUsername : <span className="text-white/30 italic">Not logged in</span>}
        </span>
        <h1 className="font-black tracking-widest text-xs sm:text-sm flex-shrink-0"
          style={{ color: "#00d4ff", textShadow: "0 0 12px rgba(0,212,255,0.6)" }}>
          🌊 PACIFIC ZOMBIE FIGHTER
        </h1>
        {loggedIn ? (
          <button onClick={() => { clearAuth(); onLogout(); }}
            className="text-white/30 text-xs hover:text-white/60 transition flex-shrink-0">
            Logout
          </button>
        ) : (
          <span className="flex-shrink-0 w-12" />
        )}
      </div>

      {/* Tournament banner */}
      {(tournament || tournamentStatus === "none") && (
        <div className="text-center py-1 px-2 flex-shrink-0">
          {tournament ? (
            <span className={`text-xs font-bold px-3 py-0.5 rounded ${canPlay ? "bg-cyan-500/15 text-cyan-400" : "bg-yellow-500/15 text-yellow-400"}`}>
              {canPlay ? `🟢 ${tournament.name} · ${timeLeft} left` : `⏳ ${tournament.name} — starts soon`}
            </span>
          ) : (
            <span className="text-xs text-white/20">No active tournament</span>
          )}
        </div>
      )}

      {devtoolsWarning && (
        <div className="mx-3 flex-shrink-0 text-center text-xs text-red-400 bg-red-900/20 border border-red-500/30 rounded py-1 px-3">
          ⛔ Developer tools detected — session invalidated.
        </div>
      )}

      {/* Main area */}
      <div className="flex flex-1 min-h-0 gap-2 p-2">

        {/* Canvas area */}
        <div className="flex-1 min-w-0 flex items-center justify-center min-h-0">
          <div className="relative w-full"
            style={{ aspectRatio: `${CW} / ${CH}`, maxHeight: "100%", maxWidth: `calc((100vh - 120px) * ${CW / CH})` }}>

            <canvas
              ref={canvasRef}
              width={CW} height={CH}
              onClick={handleCanvasClick}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              style={{ display: gameState === "playing" ? "block" : "none", width: "100%", height: "100%", touchAction: "none" }}
              className="rounded-lg cursor-crosshair"
            />

            {/* Menu */}
            {gameState === "menu" && (
              <div className="absolute inset-0 rounded-lg flex items-center justify-center" style={overlayBg}>
                <div className="absolute inset-0 rounded-lg" style={{ background: "rgba(0,5,15,0.72)" }} />
                <div className="relative z-10 rounded-xl p-6 sm:p-10 text-center mx-4 border"
                  style={{ background: "rgba(0,10,25,0.88)", borderColor: "rgba(0,200,255,0.35)", boxShadow: "0 0 40px rgba(0,200,255,0.15)" }}>
                  <p className="text-xs font-bold tracking-widest mb-1" style={{ color: "rgba(0,200,255,0.6)" }}>PACIFIC POD NFT PRESENTS</p>
                  <h2 className="text-3xl sm:text-4xl font-black tracking-widest mb-1"
                    style={{ color: "#00d4ff", textShadow: "0 0 30px rgba(0,212,255,0.8)" }}>PACIFIC</h2>
                  <h3 className="text-2xl sm:text-3xl font-black text-white tracking-widest mb-5">ZOMBIE FIGHTER</h3>
                  <p className="text-white/40 text-xs sm:text-sm mb-6">
                    <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-white">A</kbd>{" / "}
                    <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-white">D</kbd>{" "}
                    or arrows to move ·{" "}
                    <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-white">Click</kbd> to shoot
                  </p>
                  {/* Tournament / competitive play button */}
                  {loggedIn && canPlay && (
                    <button onClick={startGame}
                      className="font-black px-8 py-3 rounded text-lg tracking-widest transition uppercase text-black mb-3 block w-full"
                      style={{ background: "linear-gradient(135deg, #00d4ff, #0080ff)", boxShadow: "0 0 30px rgba(0,180,255,0.4)" }}>
                      Enter the Deep
                    </button>
                  )}
                  {loggedIn && !canPlay && (
                    <div className="text-white/40 text-sm border border-white/10 px-6 py-3 rounded mb-3">
                      {tournamentStatus === "upcoming" ? "Tournament hasn't started yet" : "No active tournament"}
                    </div>
                  )}

                  {/* Demo mode — always available */}
                  <button onClick={startDemoGame}
                    className="font-black px-8 py-2.5 rounded text-base tracking-widest transition uppercase border w-full"
                    style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(0,200,255,0.3)", color: "rgba(0,212,255,0.8)" }}>
                    🎮 Play Demo
                  </button>
                  {!loggedIn && (
                    <p className="text-white/25 text-xs mt-2">Scores not saved · <span className="text-cyan-500/50">Login</span> to compete</p>
                  )}
                </div>
              </div>
            )}

            {/* Game Over */}
            {gameState === "over" && (
              <div className="absolute inset-0 rounded-lg flex items-center justify-center" style={overlayBg}>
                <div className="absolute inset-0 rounded-lg" style={{ background: "rgba(0,0,10,0.8)" }} />
                <div className="relative z-10 rounded-xl p-6 sm:p-10 text-center w-72 sm:w-80 border"
                  style={{ background: "rgba(0,5,20,0.92)", borderColor: "rgba(255,50,50,0.35)" }}>
                  <h2 className="text-3xl sm:text-4xl font-black tracking-widest mb-2 text-red-400">GAME OVER</h2>
                  <p className="text-5xl sm:text-6xl font-black text-yellow-400 my-3">{score}</p>
                  <p className="text-white/40 text-sm mb-5">Final Score</p>

                  {devtoolsWarning && (
                    <p className="text-red-400 text-xs mb-4 bg-red-900/20 border border-red-500/20 rounded p-2">
                      Score invalidated — DevTools detected.
                    </p>
                  )}

                  {playMode === "demo" ? (
                    <div className="mb-4">
                      <p className="text-white/40 text-xs mb-3 border border-white/10 rounded px-3 py-2">
                        🎮 Demo mode — score not saved
                      </p>
                      {!loggedIn && (
                        <p className="text-cyan-400/60 text-xs mb-3">Login to compete on the leaderboard!</p>
                      )}
                    </div>
                  ) : (
                    <>
                      {!submitted && !devtoolsWarning && sessionTokenRef.current && (
                        <button onClick={submitScore} disabled={submitting}
                          className="w-full disabled:opacity-50 text-black font-black py-2.5 rounded tracking-widest uppercase mb-3 transition"
                          style={{ background: "linear-gradient(135deg, #00d4ff, #0080ff)" }}>
                          {submitting ? "Saving..." : "Submit Score"}
                        </button>
                      )}
                      {submitted && <p className="text-cyan-400 font-bold mb-3">✓ Score submitted!</p>}
                      {submitError && <p className="text-red-400 text-xs mb-3">{submitError}</p>}
                    </>
                  )}

                  {/* Play again buttons */}
                  {playMode === "demo" ? (
                    <button onClick={startDemoGame}
                      className="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-2 rounded tracking-wider uppercase text-sm transition mb-2">
                      Play Again (Demo)
                    </button>
                  ) : (
                    canPlay && !devtoolsWarning && (
                      <button onClick={startGame}
                        className="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-2 rounded tracking-wider uppercase text-sm transition mb-2">
                        Play Again
                      </button>
                    )
                  )}
                  <button onClick={() => { setGameState("menu"); setPlayMode(null); }}
                    className="w-full bg-white/5 hover:bg-white/10 text-white/40 font-bold py-1.5 rounded tracking-wider uppercase text-xs transition">
                    Back to Menu
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar — login form when logged out, leaderboard when logged in */}
        <div className="w-44 sm:w-52 flex-shrink-0 min-h-0">
          {!loggedIn ? (
            <div className="flex flex-col h-full overflow-hidden rounded-lg border border-cyan-500/30" style={{ background: "rgba(0,20,30,0.92)" }}>
              {/* Login form */}
              <div className="px-3 py-2 border-b border-cyan-500/20 flex-shrink-0" style={{ background: "rgba(0,60,80,0.5)" }}>
                <p className="text-cyan-400 font-black tracking-widest text-xs uppercase">🔐 Login to Play</p>
              </div>
              <form onSubmit={handleSidebarLogin} className="p-3 space-y-2.5 flex-shrink-0">
                <div>
                  <label className="block text-cyan-400/70 text-[10px] font-bold mb-1 tracking-widest uppercase">Discord Username</label>
                  <input
                    type="text"
                    value={loginUsername}
                    onChange={e => setLoginUsername(e.target.value)}
                    placeholder="Username"
                    required
                    autoComplete="username"
                    className="w-full bg-black/60 border border-cyan-500/30 text-white placeholder-white/20 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-cyan-400 transition"
                  />
                </div>
                <div>
                  <label className="block text-cyan-400/70 text-[10px] font-bold mb-1 tracking-widest uppercase">Password</label>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    className="w-full bg-black/60 border border-cyan-500/30 text-white placeholder-white/20 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-cyan-400 transition"
                  />
                </div>
                {loginError && (
                  <p className="text-red-400 text-[10px] bg-red-900/20 border border-red-500/20 rounded p-1.5">{loginError}</p>
                )}
                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full text-black font-black py-2 rounded text-xs tracking-widest uppercase transition disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, #00d4ff, #0080ff)" }}
                >
                  {loginLoading ? "Logging in..." : "Login"}
                </button>
              </form>
              {/* Mini leaderboard below login */}
              <div className="flex-1 overflow-y-auto border-t border-cyan-500/15">
                <div className="px-3 py-1.5 border-b border-cyan-500/15" style={{ background: "rgba(0,40,60,0.4)" }}>
                  <p className="text-cyan-400/60 text-[10px] font-black tracking-widest uppercase">🌊 Leaderboard</p>
                </div>
                {leaderboard.length === 0 ? (
                  <div className="text-white/20 text-[10px] text-center py-4">🧟 No scores yet</div>
                ) : leaderboard.map(e => (
                  <div key={e.discordUsername} className="flex items-center gap-1.5 px-3 py-1.5 border-b border-white/5">
                    <span className={`text-[10px] w-5 text-center flex-shrink-0 font-black ${RANK_COLOR[e.rank] ?? "text-white/40"}`}>
                      {RANK_MEDAL[e.rank] ?? `#${e.rank}`}
                    </span>
                    <p className="flex-1 min-w-0 text-[10px] text-white/60 truncate">{e.discordUsername}</p>
                    <span className="text-yellow-400 font-black text-[10px] flex-shrink-0">{e.bestScore}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <LiveLeaderboard entries={leaderboard} myUsername={user?.discordUsername ?? ""} tournament={tournament} />
          )}
        </div>
      </div>
    </div>
  );
}
