import { useEffect, useRef, useState, useCallback } from "react";
import { api, Tournament, LeaderboardEntry } from "@/lib/api";
import { getAuth, clearAuth, saveAuth } from "@/lib/auth";
import { detectDevTools } from "@/lib/anticheats";

interface Props { onLogout: () => void; loggedIn?: boolean; onLogin?: () => void; }

type GameState = "menu" | "playing" | "over";
type PlayMode = "tournament" | "demo" | null;

interface Bullet { x: number; y: number; vy: number; charId: string }
interface Zombie { x: number; y: number; w: number; h: number; speed: number; hp: number; flash: number; phase: number }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; r: number; color: string }
interface Bubble { x: number; y: number; r: number; vy: number; alpha: number }

const CW = 780;
const CH = 560;

const CHARACTERS = [
  { id: "core",      name: "Minara Core",  src: "/assets/characters/minara-core.png",      shooterSrc: "/assets/shooter.png",                                    color: "#c084fc", bg: "rgba(192,132,252,0.25)" },
  { id: "hacker",    name: "Hacker",       src: "/assets/characters/minara-hacker.png",    shooterSrc: "/assets/characters/minara-hacker-shooter.png",    color: "#60a5fa", bg: "rgba(96,165,250,0.25)" },
  { id: "arcane",    name: "Arcane",       src: "/assets/characters/minara-arcane.png",    shooterSrc: "/assets/characters/minara-arcane-shooter.png",    color: "#a78bfa", bg: "rgba(167,139,250,0.25)" },
  { id: "cyber",     name: "Cyber",        src: "/assets/characters/minara-cyber.png",     shooterSrc: "/assets/characters/minara-cyber-shooter.png",     color: "#f472b6", bg: "rgba(244,114,182,0.25)" },
  { id: "commander", name: "Commander",    src: "/assets/characters/minara-commander.png", shooterSrc: "/assets/characters/minara-commander-shooter.png", color: "#fbbf24", bg: "rgba(251,191,36,0.25)" },
];

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

function LiveLeaderboard({ entries, myUsername, tournament, tournamentStatus }: {
  entries: LeaderboardEntry[]; myUsername: string; tournament: Tournament | null; tournamentStatus: string;
}) {
  const [timeLeft, setTimeLeft] = useState("");
  useEffect(() => {
    if (!tournament) return;
    const tick = () => setTimeLeft(fmt(Math.max(0, new Date(tournament.endTime).getTime() - Date.now())));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [tournament]);

  const isEnded = tournamentStatus === "ended" || (tournament ? new Date(tournament.endTime) <= new Date() : false);

  return (
    <div className="flex flex-col h-full overflow-hidden rounded-lg" style={{ background: "#F2EDE3", border: "1.5px solid #1C1A18" }}>
      <div className="px-3 py-2 border-b flex-shrink-0" style={{ background: "#1C1A18", borderColor: "#1C1A18" }}>
        <p className="font-black tracking-widest text-xs uppercase" style={{ color: "#EDE8DC" }}>🤖 Leaderboard</p>
        {tournament && (
          isEnded
            ? <p className="text-xs font-bold mt-0.5" style={{ color: "#E8729A" }}>🔴 ENDED · Final Scores</p>
            : <p className="text-xs font-mono mt-0.5 truncate" style={{ color: "rgba(237,232,220,0.6)" }}>{timeLeft} left</p>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-xs text-center px-3 py-8" style={{ color: "#C8C3BA" }}>
            <span className="text-2xl mb-2">🤖</span>No scores yet
          </div>
        ) : entries.map((e) => {
          const isMe = e.discordUsername === myUsername;
          return (
            <div key={e.discordUsername}
              className={`flex items-center gap-2 px-3 py-2 border-b`}
              style={{ borderColor: "#D4CFC4", background: isMe ? "rgba(232,114,154,0.1)" : "transparent" }}>
              <span className={`text-sm w-6 text-center flex-shrink-0 font-black ${RANK_COLOR[e.rank] ?? ""}`}
                style={!RANK_COLOR[e.rank] ? { color: "#C8C3BA" } : {}}>
                {RANK_MEDAL[e.rank] ?? `#${e.rank}`}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold truncate" style={{ color: isMe ? "#E8729A" : "#1C1A18" }}>
                  {e.discordUsername}{isMe && <span className="ml-1" style={{ color: "#E8729A" }}>←</span>}
                </p>
                <p className="text-[10px]" style={{ color: "#C8C3BA" }}>{e.gamesPlayed}× played</p>
              </div>
              <span className="font-black text-sm flex-shrink-0" style={{ color: "#1C1A18" }}>{e.bestScore}</span>
            </div>
          );
        })}
      </div>
      <div className="px-3 py-1.5 border-t flex-shrink-0" style={{ borderColor: "#D4CFC4" }}>
        <p className="text-[10px] text-center" style={{ color: "#C8C3BA" }}>Refreshes every 10s</p>
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
  const [tournamentStatus, setTournamentStatus] = useState<"active" | "upcoming" | "ended" | "none">("none");
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
  const [isMobile, setIsMobile] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const isMobileRef = useRef(false);
  const [selectedChar, setSelectedChar] = useState(0);
  const selectedCharRef = useRef(0);
  const charImgs = useRef<HTMLImageElement[]>([]);

  const sessionTokenRef = useRef<string | null>(null);
  const [tournamentEndedWhilePlaying, setTournamentEndedWhilePlaying] = useState(false);
  const gameStateRef = useRef<GameState>("menu");
  const playModeRef = useRef<PlayMode>(null);

  const gs = useRef({
    shooter: { x: CW / 2 - 48, y: CH - 110, w: 96, h: 96, speed: 14 },
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
    chartPoints: [] as number[],
    chartScroll: 0,
    scanY: 0,
    pulses: [] as Array<{ x: number; y: number; r: number; maxR: number; alpha: number }>,
    lastPulse: 0,
    signals: [] as Array<{ x: number; y: number; vy: number; text: string; color: string; alpha: number }>,
    lastSignal: 0,
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
    // Preload all character images
    charImgs.current = CHARACTERS.map(c => { const img = new Image(); img.src = c.shooterSrc; return img; });
    shooterImg.current = charImgs.current[0];
    zombieImg.current.src = "/assets/zombie.png";
    bgImg.current.src = "/assets/background.png";

    // Detect mobile/touch device
    const mq = window.matchMedia("(max-width: 639px)");
    const checkMobile = () => { const m = mq.matches || navigator.maxTouchPoints > 0; setIsMobile(m); isMobileRef.current = m; };
    checkMobile();
    mq.addEventListener("change", checkMobile);

    // init background bubbles
    const s = gs.current;
    for (let i = 0; i < 22; i++) {
      s.bubbles.push({
        x: Math.random() * CW, y: Math.random() * CH,
        r: 2 + Math.random() * 5, vy: 0.3 + Math.random() * 0.7,
        alpha: 0.08 + Math.random() * 0.28,
      });
    }

    // init chart with random price walk
    s.chartPoints = [];
    s.pulses = [];
    s.signals = [];
    let price = 45 + Math.random() * 20;
    for (let i = 0; i < 220; i++) {
      price += (Math.random() - 0.47) * 2.8;
      price = Math.max(8, Math.min(92, price));
      s.chartPoints.push(price);
    }
    s.chartScroll = 0;
    s.scanY = 0;
    s.lastPulse = 0;
    s.lastSignal = 0;

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
    return () => { clearInterval(lb); clearInterval(tr); stopDetect(); mq.removeEventListener("change", checkMobile); };
  }, [fetchTournament, fetchLeaderboard]);

  // Keep refs in sync so setTimeout callbacks read current state without stale closures
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { playModeRef.current = playMode; }, [playMode]);

  // Auto-submit score when the game ends normally (player dies in tournament mode)
  useEffect(() => {
    if (gameState === "over" && playModeRef.current === "tournament" && !devtoolsWarning) {
      autoSubmitScore();
    }
  }, [gameState]);

  useEffect(() => {
    if (!tournament) return;
    const startMs = new Date(tournament.startTime).getTime();
    const endMs = new Date(tournament.endTime).getTime();
    const syncTournamentStatus = () => {
      const now = Date.now();
      if (now < startMs) {
        setTournamentStatus("upcoming");
      } else if (now <= endMs) {
        setTournamentStatus("active");
      } else {
        setTournamentStatus("ended");
      }
    };
    const tick = () => {
      syncTournamentStatus();
      const targetMs = tournamentStatus === "upcoming" ? startMs : endMs;
      setTimeLeft(fmt(Math.max(0, targetMs - Date.now())));
    };
    tick();
    const t = setInterval(tick, 1000);

    // When tournament expires mid-game: force-end and auto-submit the score
    const remaining = endMs - Date.now();
    let endTimer: ReturnType<typeof setTimeout> | null = null;
    if (remaining > 0) {
      endTimer = setTimeout(async () => {
        if (gameStateRef.current === "playing" && playModeRef.current === "tournament") {
          const pts = gs.current.pts;
          const token = sessionTokenRef.current;
          gs.current.dead = true;
          cancelAnimationFrame(gs.current.animId);
          setScore(pts);
          setGameState("over");
          setTournamentEndedWhilePlaying(true);
          if (token) {
            sessionTokenRef.current = token;
            await autoSubmitScore();
          }
        }
      }, remaining);
    }

    return () => {
      clearInterval(t);
      if (endTimer) clearTimeout(endTimer);
    };
  }, [tournament, tournamentStatus, fetchLeaderboard]);

  async function startGame() {
    try { const { sessionToken } = await api.startSession(); sessionTokenRef.current = sessionToken; } catch { return; }
    const s = gs.current;
    s.shooter = { x: CW / 2 - 48, y: CH - 110, w: 96, h: 96, speed: 14 };
    s.bullets = []; s.zombies = []; s.particles = [];
    s.keys = { a: false, d: false, left: false, right: false };
    s.pts = 0; s.hp = 100; s.dead = false; s.frame = 0; s.diffMult = 1; s.screenShake = 0; s.lastShot = 0; s.lastFrameTime = 0;
    setScore(0); setHealth(100);
    setSubmitted(false); setSubmitError(""); setDevtoolsWarning(false);
    setTournamentEndedWhilePlaying(false);
    setPlayMode("tournament");
    setGameState("playing");
    requestAnimationFrame(loop);
  }

  function startDemoGame() {
    if (loggedIn) return;
    sessionTokenRef.current = null;
    const s = gs.current;
    s.shooter = { x: CW / 2 - 48, y: CH - 110, w: 96, h: 96, speed: 14 };
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
    // Gold and green — profits booked!
    const colors = ["#E8729A", "#fbbf24", "#f59e0b", "#fcd34d", "#22c55e", "#EDE8DC"];
    for (let i = 0; i < 14; i++) {
      const angle = (Math.PI * 2 * i) / 14 + Math.random() * 0.5;
      const speed = 2.5 + Math.random() * 5;
      s.particles.push({
        x, y,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life: 1, maxLife: 1,
        r: 3 + Math.random() * 5,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
  }

  function drawBullet(ctx: CanvasRenderingContext2D, b: Bullet) {
    const cx = b.x + 3, cy = b.y + 6;

    if (b.charId === "fire") {
      // Fireball — orange/red flame orb with trailing flicker
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 13);
      grad.addColorStop(0, "rgba(255,255,180,1)");
      grad.addColorStop(0.3, "rgba(255,140,0,0.95)");
      grad.addColorStop(0.7, "rgba(220,40,0,0.7)");
      grad.addColorStop(1, "rgba(100,0,0,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 11, 15, 0, 0, Math.PI * 2);
      ctx.fill();
      // flame tip
      ctx.fillStyle = "rgba(255,220,80,0.9)";
      ctx.beginPath();
      ctx.ellipse(cx, cy - 8, 4, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      // glow
      ctx.shadowColor = "#ff6600";
      ctx.shadowBlur = 18;
      ctx.fillStyle = "rgba(255,100,0,0.3)";
      ctx.beginPath();
      ctx.ellipse(cx, cy, 14, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

    } else if (b.charId === "stone") {
      // Rock — grey jagged boulder
      ctx.save();
      ctx.translate(cx, cy);
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 10);
      grad.addColorStop(0, "#d0d0d0");
      grad.addColorStop(0.5, "#888");
      grad.addColorStop(1, "#444");
      ctx.fillStyle = grad;
      ctx.beginPath();
      // jagged polygon for rock shape
      ctx.moveTo(0, -12);
      ctx.lineTo(7, -7);
      ctx.lineTo(10, 0);
      ctx.lineTo(6, 8);
      ctx.lineTo(0, 10);
      ctx.lineTo(-6, 7);
      ctx.lineTo(-9, -1);
      ctx.lineTo(-5, -9);
      ctx.closePath();
      ctx.fill();
      // crack detail
      ctx.strokeStyle = "rgba(60,60,60,0.6)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-2, -6); ctx.lineTo(3, 2); ctx.lineTo(-1, 6);
      ctx.stroke();
      // highlight
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.beginPath();
      ctx.ellipse(-3, -4, 3, 4, -0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

    } else if (b.charId === "squad") {
      // Rainbow blast — cycling colour rings
      const t = performance.now() / 120;
      const colors = ["#ff4444","#ff9900","#ffee00","#44ff44","#00aaff","#cc44ff"];
      for (let i = 0; i < colors.length; i++) {
        const angle = (t + i * (Math.PI * 2 / colors.length));
        const ox = Math.cos(angle) * 4;
        const oy = Math.sin(angle) * 2;
        const grad = ctx.createRadialGradient(cx + ox, cy + oy, 0, cx + ox, cy + oy, 7);
        grad.addColorStop(0, colors[i] + "ff");
        grad.addColorStop(1, colors[i] + "00");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(cx + ox, cy + oy, 7, 7, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // bright white core
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.ellipse(cx, cy, 3, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      // sparkle ring glow
      ctx.shadowColor = "#ffffff";
      ctx.shadowBlur = 12;
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.beginPath();
      ctx.ellipse(cx, cy, 5, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

    } else {
      // Minara signal shot — pink/gold trading signal orb
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 11);
      grad.addColorStop(0, "rgba(255,240,200,1)");
      grad.addColorStop(0.35, "rgba(232,114,154,0.95)");
      grad.addColorStop(0.75, "rgba(180,60,100,0.6)");
      grad.addColorStop(1, "rgba(80,0,40,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 10, 15, 0, 0, Math.PI * 2);
      ctx.fill();
      // bright core
      ctx.fillStyle = "rgba(255,255,220,0.95)";
      ctx.beginPath();
      ctx.ellipse(cx, cy - 2, 3, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      // glow
      ctx.shadowColor = "#E8729A";
      ctx.shadowBlur = 12;
      ctx.fillStyle = "rgba(232,114,154,0.25)";
      ctx.beginPath();
      ctx.ellipse(cx, cy, 13, 17, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  function drawHud(ctx: CanvasRenderingContext2D, pts: number, hp: number) {
    // Score box — dark card, gold text
    ctx.fillStyle = "rgba(10,8,6,0.82)";
    ctx.beginPath();
    ctx.roundRect(8, 8, 190, 66, 6);
    ctx.fill();
    ctx.strokeStyle = "rgba(232,114,154,0.5)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = "bold 11px 'Inter', sans-serif";
    ctx.fillStyle = "rgba(200,195,186,0.9)";
    ctx.fillText("PROFIT SCORE", 18, 26);
    ctx.font = "bold 28px 'Georgia', serif";
    ctx.fillStyle = "#E8729A";
    ctx.fillText("$" + String(pts), 18, 56);

    // Health bar — dark card, colored bar
    ctx.fillStyle = "rgba(10,8,6,0.82)";
    ctx.beginPath();
    ctx.roundRect(CW - 194, 8, 186, 66, 6);
    ctx.fill();
    ctx.strokeStyle = "rgba(232,114,154,0.5)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.font = "bold 11px 'Inter', sans-serif";
    ctx.fillStyle = "rgba(200,195,186,0.9)";
    ctx.fillText("PORTFOLIO HEALTH", CW - 184, 26);
    const barW = 162;
    const barFill = (hp / 100) * barW;
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.beginPath(); ctx.roundRect(CW - 184, 36, barW, 16, 4); ctx.fill();
    const hc = hp > 60 ? "#22c55e" : hp > 30 ? "#facc15" : "#ef4444";
    ctx.fillStyle = hc;
    if (barFill > 0) { ctx.beginPath(); ctx.roundRect(CW - 184, 36, barFill, 16, 4); ctx.fill(); }
    ctx.font = "bold 11px monospace";
    ctx.fillStyle = "white";
    ctx.fillText(`${hp}%`, CW - 184 + barW / 2 - 14, 49);
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

    // Auto-fire on mobile: shoot every 400ms automatically
    if (isMobileRef.current) {
      const now2 = performance.now();
      if (now2 - s.lastShot >= 400) {
        s.lastShot = now2;
        s.bullets.push({ x: s.shooter.x + s.shooter.w / 2 - 3, y: s.shooter.y + 10, vy: -14, charId: CHARACTERS[selectedCharRef.current].id });
        playMagicShot();
      }
    }

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
    if (bgImg.current.complete && bgImg.current.naturalWidth > 0) {
      ctx.drawImage(bgImg.current, 0, 0, CW, CH);
    } else {
      const grad = ctx.createLinearGradient(0, 0, 0, CH);
      grad.addColorStop(0, "#05080F");
      grad.addColorStop(0.5, "#0A0E18");
      grad.addColorStop(1, "#060A12");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, CW, CH);
    }

    // ── Grid overlay ─────────────────────────────────────────────
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 1;
    for (let gx = 0; gx <= CW; gx += 78) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, CH); ctx.stroke();
    }
    for (let gy = 0; gy <= CH; gy += 65) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(CW, gy); ctx.stroke();
    }
    ctx.restore();

    // ── Scrolling line chart ─────────────────────────────────────
    {
      const cps = s.chartPoints;
      s.chartScroll += 0.55 * dt;

      // Add a new price point every 7 frames
      if (s.frame % 7 === 0) {
        const last = cps[cps.length - 1] ?? 50;
        const next = last + (Math.random() - 0.47) * 2.8 * s.diffMult;
        cps.push(Math.max(6, Math.min(94, next)));
        if (cps.length > 320) cps.shift();
      }

      const stride = 10;
      const visibleCount = Math.ceil(CW / stride) + 4;
      const slice = cps.slice(Math.max(0, cps.length - visibleCount));
      const chartTop = CH * 0.52;
      const chartH = CH * 0.42;
      const scrollOff = s.chartScroll % stride;

      if (slice.length > 1) {
        const minP = Math.min(...slice) - 4;
        const maxP = Math.max(...slice) + 4;
        const scaleP = (p: number) => chartTop + chartH - ((p - minP) / (maxP - minP)) * chartH;

        // Area fill
        ctx.save();
        ctx.beginPath();
        slice.forEach((p, i) => {
          const x = i * stride - scrollOff;
          const y = scaleP(p);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        const lastX = (slice.length - 1) * stride - scrollOff;
        ctx.lineTo(lastX, chartTop + chartH);
        ctx.lineTo(-scrollOff, chartTop + chartH);
        ctx.closePath();
        const areaGrad = ctx.createLinearGradient(0, chartTop, 0, chartTop + chartH);
        areaGrad.addColorStop(0, "rgba(34,197,94,0.28)");
        areaGrad.addColorStop(1, "rgba(34,197,94,0.0)");
        ctx.fillStyle = areaGrad;
        ctx.globalAlpha = 0.9;
        ctx.fill();

        // Line
        ctx.beginPath();
        slice.forEach((p, i) => {
          const x = i * stride - scrollOff;
          const y = scaleP(p);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = "#22c55e";
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.7;
        ctx.shadowColor = "#22c55e";
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Candle-style bar markers every 5 points
        ctx.globalAlpha = 0.55;
        for (let i = 4; i < slice.length; i += 5) {
          const x = i * stride - scrollOff + stride / 2;
          const open = scaleP(slice[i - 4]);
          const close = scaleP(slice[i]);
          const high = scaleP(Math.max(...slice.slice(i - 4, i + 1)));
          const low = scaleP(Math.min(...slice.slice(i - 4, i + 1)));
          const isUp = slice[i] >= slice[i - 4];
          const candleColor = isUp ? "#22c55e" : "#ef4444";
          ctx.strokeStyle = candleColor;
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(x, high); ctx.lineTo(x, low); ctx.stroke();
          ctx.fillStyle = candleColor;
          const bodyTop = Math.min(open, close);
          const bodyH = Math.max(2, Math.abs(close - open));
          ctx.fillRect(x - 3, bodyTop, 6, bodyH);
        }
        ctx.restore();
      }
    }

    // ── Expanding pulse rings ─────────────────────────────────────
    {
      const now2 = performance.now();
      if (now2 - s.lastPulse > 900) {
        s.lastPulse = now2;
        s.pulses.push({
          x: 80 + Math.random() * (CW - 160),
          y: CH * 0.25 + Math.random() * CH * 0.5,
          r: 0, maxR: 55 + Math.random() * 90, alpha: 0.55,
        });
      }
      for (let i = s.pulses.length - 1; i >= 0; i--) {
        const p = s.pulses[i];
        p.r += 1.6 * dt;
        p.alpha -= 0.007 * dt;
        if (p.alpha <= 0 || p.r >= p.maxR) { s.pulses.splice(i, 1); continue; }
        ctx.save();
        ctx.globalAlpha = p.alpha * 0.35;
        ctx.strokeStyle = "#E8729A";
        ctx.lineWidth = 1.5;
        ctx.shadowColor = "#E8729A";
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = p.alpha * 0.12;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 0.55, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // ── CRT scan line ─────────────────────────────────────────────
    {
      s.scanY += 1.4 * dt;
      if (s.scanY > CH + 30) s.scanY = -30;
      const sg = ctx.createLinearGradient(0, s.scanY - 18, 0, s.scanY + 18);
      sg.addColorStop(0, "rgba(34,197,94,0)");
      sg.addColorStop(0.5, "rgba(34,197,94,0.10)");
      sg.addColorStop(1, "rgba(34,197,94,0)");
      ctx.fillStyle = sg;
      ctx.fillRect(0, s.scanY - 18, CW, 36);
    }

    // ── Floating signals ──────────────────────────────────────────
    {
      const signalTexts = ["BUY", "SELL", "RSI 72", "MACD ↑", "BULL", "BEAR", "+2.4%", "-1.8%", "ATH!", "DIP?", "HODL", "ENTRY"];
      const signalColors = ["#22c55e","#ef4444","#fbbf24","#60a5fa","#22c55e","#ef4444","#22c55e","#ef4444","#22c55e","#ef4444","#a78bfa","#E8729A"];
      const now3 = performance.now();
      if (now3 - s.lastSignal > 1600) {
        s.lastSignal = now3;
        const idx = Math.floor(Math.random() * signalTexts.length);
        s.signals.push({
          x: 30 + Math.random() * (CW - 100),
          y: CH * 0.85,
          vy: 0.5 + Math.random() * 0.7,
          text: signalTexts[idx],
          color: signalColors[idx],
          alpha: 0.55 + Math.random() * 0.25,
        });
      }
      for (let i = s.signals.length - 1; i >= 0; i--) {
        const sig = s.signals[i];
        sig.y -= sig.vy * dt;
        sig.alpha -= 0.003 * dt;
        if (sig.alpha <= 0 || sig.y < -20) { s.signals.splice(i, 1); continue; }
        ctx.save();
        ctx.globalAlpha = sig.alpha;
        ctx.font = "bold 11px monospace";
        ctx.fillStyle = sig.color;
        ctx.shadowColor = sig.color;
        ctx.shadowBlur = 8;
        ctx.fillText(sig.text, sig.x, sig.y);
        ctx.restore();
      }
    }

    // ── Dark vignette overlay ─────────────────────────────────────
    const vignette = ctx.createRadialGradient(CW/2, CH/2, CH*0.22, CW/2, CH/2, CH*0.88);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,0.62)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, CW, CH);

    // ── Floating ticker numbers ───────────────────────────────────
    for (const b of s.bubbles) {
      b.y -= b.vy * dt;
      if (b.y < -20) { b.y = CH + 20; b.x = Math.random() * CW; b.alpha = 0.08 + Math.random() * 0.28; }
      const isGreen = b.alpha > 0.15;
      ctx.font = `bold ${Math.round(b.r * 1.3)}px monospace`;
      ctx.fillStyle = isGreen
        ? `rgba(34,197,94,${b.alpha * 0.85})`
        : `rgba(239,68,68,${b.alpha * 0.85})`;
      ctx.fillText(isGreen ? `+${(b.r * 0.8).toFixed(2)}%` : `-${(b.r * 0.5).toFixed(2)}%`, b.x, b.y);
    }

    // Shooter movement (arrow keys OR A/D)
    const movingLeft = s.keys.a || s.keys.left;
    const movingRight = s.keys.d || s.keys.right;
    if (movingLeft && s.shooter.x > 0) { s.shooter.x -= s.shooter.speed * dt; s.lastDir = -1; }
    if (movingRight && s.shooter.x < CW - s.shooter.w) { s.shooter.x += s.shooter.speed * dt; s.lastDir = 1; }

    // Zombies
    const spawnChance = 0.06 + s.diffMult * 0.010;
    if (Math.random() < spawnChance) {
      const sz = 72 + Math.random() * 20;
      const speed = (4.0 + Math.random() * 3.0) * s.diffMult;
      s.zombies.push({ x: Math.random() * (CW - sz), y: -sz, w: sz, h: sz, speed, hp: 1, flash: 0, phase: Math.random() * Math.PI * 2 });
    }

    for (let i = s.zombies.length - 1; i >= 0; i--) {
      const z = s.zombies[i];
      z.y += z.speed * dt;

      const t = performance.now() / 1000;
      const sway   = Math.sin(t * 2.8 + z.phase) * 5;          // side wobble ±5px
      const bob    = Math.sin(t * 4.0 + z.phase) * 2.5;         // up/down bob ±2.5px
      const tilt   = Math.sin(t * 2.8 + z.phase) * 0.13;        // lean with sway
      const scale  = 1 + Math.sin(t * 3.2 + z.phase) * 0.04;   // breathing pulse ±4%

      const drawX = z.x + sway;
      const drawY = z.y + bob;
      const cx    = drawX + z.w / 2;
      const cy    = drawY + z.h / 2;
      const sw    = z.w * scale;
      const sh    = z.h * scale;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(tilt);

      // red market-crash aura
      const aura = ctx.createRadialGradient(0, 0, sw * 0.2, 0, 0, sw * 0.72);
      aura.addColorStop(0, "rgba(255,40,40,0.22)");
      aura.addColorStop(1, "rgba(180,0,0,0)");
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.ellipse(0, 0, sw * 0.72, sh * 0.72, 0, 0, Math.PI * 2);
      ctx.fill();

      if (z.flash > 0) {
        ctx.globalAlpha = 0.45;
        z.flash--;
      }
      ctx.drawImage(zombieImg.current, -sw / 2, -sh / 2, sw, sh);
      ctx.globalAlpha = 1;
      ctx.restore();

      if (z.y > CH + 10) s.zombies.splice(i, 1);
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

          s.zombies.splice(zi, 1);
          s.bullets.splice(bi, 1);
          s.pts += 1;
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

    // Shooter — use selected character image, flip for left/right lean
    {
      const sh = s.shooter;
      const dir = s.lastDir;
      const img = charImgs.current[selectedCharRef.current] ?? shooterImg.current;
      ctx.save();
      if (dir === -1) {
        ctx.translate(sh.x + sh.w, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, sh.y, sh.w, sh.h);
      } else {
        ctx.drawImage(img, sh.x, sh.y, sh.w, sh.h);
      }
      ctx.restore();

      // Muzzle flash when shooting — at gun tip (top-centre of sprite)
      if (performance.now() - s.lastShot < 120) {
        const flashX = sh.x + sh.w * 0.5;   // centre — gun points straight up
        const flashY = sh.y - 4;             // just above the sprite top
        const charId = CHARACTERS[selectedCharRef.current]?.id ?? "og";
        const flashColors: Record<string, [string, string, string]> = {
          og:    ["rgba(255,180,255,1)", "rgba(200,80,255,0.7)",  "rgba(120,0,200,0)"],
          mvp:   ["rgba(180,220,255,1)", "rgba(40,140,255,0.8)",  "rgba(0,60,200,0)"],
          stone: ["rgba(230,230,230,1)", "rgba(150,150,150,0.7)", "rgba(60,60,60,0)"],
          fire:  ["rgba(255,255,160,1)", "rgba(255,120,0,0.8)",   "rgba(180,0,0,0)"],
          squad: ["rgba(255,255,255,1)", "rgba(180,100,255,0.7)", "rgba(255,80,180,0)"],
        };
        const [c0, c1, c2] = flashColors[charId] ?? flashColors.og;
        ctx.save();
        ctx.globalAlpha = 0.9;
        const flash = ctx.createRadialGradient(flashX, flashY, 0, flashX, flashY, 22);
        flash.addColorStop(0, c0);
        flash.addColorStop(0.5, c1);
        flash.addColorStop(1, c2);
        ctx.fillStyle = flash;
        ctx.beginPath();
        ctx.arc(flashX, flashY, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // HUD
    drawHud(ctx, s.pts, s.hp);

    // Difficulty indicator — centered top
    if (s.diffMult > 1) {
      const lvl = Math.floor(s.diffMult / 0.25) - 2;
      ctx.fillStyle = "rgba(10,8,6,0.75)";
      ctx.beginPath();
      ctx.roundRect(CW / 2 - 60, 8, 120, 28, 6);
      ctx.fill();
      ctx.strokeStyle = "rgba(239,68,68,0.6)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.font = "bold 12px monospace";
      ctx.fillStyle = "#ef4444";
      ctx.textAlign = "center";
      ctx.fillText(`🔴 BEAR MARKET LVL ${lvl}`, CW / 2, 27);
      ctx.textAlign = "left";
    }

    // Demo mode badge
    if (playMode === "demo") {
      ctx.fillStyle = "rgba(10,8,6,0.7)";
      ctx.beginPath();
      ctx.roundRect(CW / 2 - 52, CH - 30, 104, 22, 5);
      ctx.fill();
      ctx.strokeStyle = "rgba(232,114,154,0.4)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.font = "bold 11px monospace";
      ctx.fillStyle = "rgba(232,114,154,0.8)";
      ctx.textAlign = "center";
      ctx.fillText("📊 DEMO TRADING", CW / 2, CH - 15);
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
    s.bullets.push({ x: s.shooter.x + s.shooter.w / 2 - 3, y: s.shooter.y + 10, vy: -14, charId: CHARACTERS[selectedCharRef.current].id });
    playMagicShot();
  }

  // Mobile touch — canvas tap does nothing (auto-fire handles shooting)
  function handleTouchStart(e: React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
  }

  function handleTouchEnd() {
    gs.current.keys.left = false; gs.current.keys.right = false;
  }

  // Mobile on-screen button handlers
  function mobileLeft(active: boolean) { gs.current.keys.left = active; }
  function mobileRight(active: boolean) { gs.current.keys.right = active; }

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

  async function autoSubmitScore() {
    const token = sessionTokenRef.current;
    if (!token || submitted) return;
    setSubmitting(true);
    try {
      await api.submitScore(gs.current.pts, token);
      sessionTokenRef.current = null;
      setSubmitted(true);
      fetchLeaderboard();
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Failed to submit score");
    } finally {
      setSubmitting(false);
    }
  }

  const user = getAuth();
  const canPlay = tournamentStatus === "active";
  const canStartTournament = loggedIn && canPlay;
  const tournamentWaiting = loggedIn && tournamentStatus === "upcoming";
  const tournamentStartingSoon = loggedIn && tournamentStatus === "upcoming";

  const overlayBg: React.CSSProperties = {
    backgroundImage: "url('/assets/background.png')",
    backgroundSize: "cover",
    backgroundPosition: "center",
  };

  const renderSidebar = () => (
    <>
      {!loggedIn ? (
        <div className="flex flex-col h-full overflow-hidden rounded-lg" style={{ background: "#F2EDE3", border: "1.5px solid #1C1A18" }}>
          <div className="px-3 py-2 border-b flex-shrink-0 flex items-center justify-between" style={{ background: "#1C1A18", borderColor: "#1C1A18" }}>
            <p className="font-black tracking-widest text-xs uppercase" style={{ color: "#EDE8DC" }}>🔐 Login to Play</p>
            {isMobile && <button onClick={() => setShowSidebar(false)} style={{ color: "#EDE8DC" }} className="text-lg leading-none">×</button>}
          </div>
          <form onSubmit={handleSidebarLogin} className="p-3 space-y-2.5 flex-shrink-0">
            <div>
              <label className="block text-[10px] font-bold mb-1 tracking-widest uppercase" style={{ color: "#1C1A18" }}>Discord Username</label>
              <input type="text" value={loginUsername} onChange={e => setLoginUsername(e.target.value)}
                placeholder="Username" required autoComplete="username"
                className="w-full rounded px-2 py-1.5 text-xs focus:outline-none transition placeholder-stone-400"
                style={{ border: "1.5px solid #1C1A18", background: "#FFFFFF", color: "#1C1A18" }} />
            </div>
            <div>
              <label className="block text-[10px] font-bold mb-1 tracking-widest uppercase" style={{ color: "#1C1A18" }}>Password</label>
              <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)}
                placeholder="••••••••" required autoComplete="current-password"
                className="w-full rounded px-2 py-1.5 text-xs focus:outline-none transition placeholder-stone-400"
                style={{ border: "1.5px solid #1C1A18", background: "#FFFFFF", color: "#1C1A18" }} />
            </div>
            {loginError && <p className="text-red-600 text-[10px] bg-red-50 border border-red-300 rounded p-1.5">{loginError}</p>}
            <button type="submit" disabled={loginLoading}
              className="w-full font-black py-2 rounded text-xs tracking-widest uppercase transition disabled:opacity-50"
              style={{ background: "#1C1A18", color: "#EDE8DC" }}>
              {loginLoading ? "Logging in..." : "Login"}
            </button>
          </form>
          <div className="flex-1 overflow-y-auto border-t" style={{ borderColor: "#D4CFC4" }}>
            <div className="px-3 py-1.5 border-b" style={{ background: "#E8E2D6", borderColor: "#D4CFC4" }}>
              <p className="text-[10px] font-black tracking-widest uppercase" style={{ color: "#1C1A18" }}>🤖 Leaderboard</p>
            </div>
            {leaderboard.length === 0 ? (
              <div className="text-[10px] text-center py-4" style={{ color: "#C8C3BA" }}>🤖 No scores yet</div>
            ) : leaderboard.map(e => (
              <div key={e.discordUsername} className="flex items-center gap-1.5 px-3 py-1.5 border-b" style={{ borderColor: "#D4CFC4" }}>
                <span className={`text-[10px] w-5 text-center flex-shrink-0 font-black ${RANK_COLOR[e.rank] ?? ""}`}
                  style={!RANK_COLOR[e.rank] ? { color: "#C8C3BA" } : {}}>
                  {RANK_MEDAL[e.rank] ?? `#${e.rank}`}
                </span>
                <p className="flex-1 min-w-0 text-[10px] truncate" style={{ color: "#1C1A18" }}>{e.discordUsername}</p>
                <span className="font-black text-[10px] flex-shrink-0" style={{ color: "#1C1A18" }}>{e.bestScore}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="h-full">
          {isMobile && (
            <div className="flex justify-end mb-1">
              <button onClick={() => setShowSidebar(false)} style={{ color: "#1C1A18" }} className="text-lg leading-none px-2">×</button>
            </div>
          )}
          <LiveLeaderboard entries={leaderboard} myUsername={user?.discordUsername ?? ""} tournament={tournament} tournamentStatus={tournamentStatus} />
        </div>
      )}
    </>
  );

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: "100dvh", userSelect: "none", background: "#EDE8DC", color: "#1C1A18" }}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b flex-shrink-0 gap-2"
        style={{ borderColor: "#C8C3BA", background: "#EDE8DC" }}>
        <span className="font-bold text-xs truncate min-w-0" style={{ color: "#1C1A18" }}>
          {loggedIn ? user?.discordUsername : <span style={{ color: "#C8C3BA" }} className="italic">Not logged in</span>}
        </span>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="font-black tracking-wider text-xs sm:text-sm" style={{ fontFamily: "'Playfair Display', serif", color: "#1C1A18" }}>MINARA</span>
          <span className="text-xs font-bold tracking-widest" style={{ color: "#C8C3BA" }}>AI DEFENDER</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isMobile && (
            <button onClick={() => setShowSidebar(v => !v)}
              className="text-xs px-2 py-0.5 rounded font-bold" style={{ color: "#1C1A18", border: "1.5px solid #1C1A18" }}>
              {loggedIn ? "🏆" : "🔐"}
            </button>
          )}
          {loggedIn ? (
            <button onClick={() => { clearAuth(); onLogout(); }}
              className="text-xs font-bold hover:underline transition" style={{ color: "#C8C3BA" }}>
              Logout
            </button>
          ) : (
            !isMobile && <span className="w-12" />
          )}
        </div>
      </div>

      {/* Tournament banner */}
      {loggedIn && (tournament || tournamentStatus === "none") && (
        <div className="text-center py-1 px-2 flex-shrink-0" style={{ background: "#E8E2D6", borderBottom: "1px solid #D4CFC4" }}>
          {tournament ? (
            <span className="text-xs font-bold px-3 py-0.5 rounded" style={{
              background: canPlay ? "#1C1A18" : tournamentStatus === "ended" ? "#fee2e2" : "#fef9c3",
              color: canPlay ? "#EDE8DC" : tournamentStatus === "ended" ? "#b91c1c" : "#854d0e"
            }}>
              {canPlay ? `🟢 ${tournament.name} · ${timeLeft} left`
                : tournamentStatus === "ended" ? `🔴 ${tournament.name} — ENDED`
                : `⏳ ${tournament.name} — starts soon`}
            </span>
          ) : (
            <span className="text-xs" style={{ color: "#C8C3BA" }}>No active tournament</span>
          )}
        </div>
      )}

      {devtoolsWarning && (
        <div className="mx-3 flex-shrink-0 text-center text-xs text-red-600 bg-red-50 border border-red-300 rounded py-1 px-3">
          ⛔ Developer tools detected — session invalidated.
        </div>
      )}

      {/* Main area */}
      <div className="flex flex-1 min-h-0 gap-2 p-2 relative">

        {/* Canvas area */}
        <div className="flex-1 min-w-0 flex flex-col items-center justify-center min-h-0 gap-2">
          <div className="relative w-full flex-1 min-h-0 flex items-center justify-center">
            <div className="relative"
              style={{ aspectRatio: `${CW} / ${CH}`, maxHeight: "100%", maxWidth: `calc((100dvh - 120px) * ${CW / CH})`, width: "100%" }}>

              <canvas
                ref={canvasRef}
                width={CW} height={CH}
                onClick={handleCanvasClick}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                style={{ display: gameState === "playing" ? "block" : "none", width: "100%", height: "100%", touchAction: "none" }}
                className="rounded-lg cursor-crosshair"
              />

              {/* Mobile on-screen controls — 2 big thumb buttons, auto-fire handles shooting */}
              {gameState === "playing" && isMobile && (
                <div className="absolute bottom-2 left-0 right-0 flex items-center justify-between px-4 pointer-events-none z-10">
                  {/* Left button */}
                  <button
                    className="pointer-events-auto rounded-2xl flex items-center justify-center font-black text-3xl select-none"
                    style={{ width: 110, height: 90, background: "rgba(192,132,252,0.2)", border: "2px solid rgba(192,132,252,0.5)", color: "#c084fc", WebkitTapHighlightColor: "transparent", touchAction: "none" }}
                    onPointerDown={() => mobileLeft(true)}
                    onPointerUp={() => mobileLeft(false)}
                    onPointerLeave={() => mobileLeft(false)}
                    onPointerCancel={() => mobileLeft(false)}
                  >◀</button>
                  {/* Auto-fire label in centre */}
                  <span className="text-white/20 text-[10px] font-bold tracking-widest uppercase pointer-events-none">AUTO</span>
                  {/* Right button */}
                  <button
                    className="pointer-events-auto rounded-2xl flex items-center justify-center font-black text-3xl select-none"
                    style={{ width: 110, height: 90, background: "rgba(192,132,252,0.2)", border: "2px solid rgba(192,132,252,0.5)", color: "#c084fc", WebkitTapHighlightColor: "transparent", touchAction: "none" }}
                    onPointerDown={() => mobileRight(true)}
                    onPointerUp={() => mobileRight(false)}
                    onPointerLeave={() => mobileRight(false)}
                    onPointerCancel={() => mobileRight(false)}
                  >▶</button>
                </div>
              )}

              {/* Menu */}
              {gameState === "menu" && (
                <div className="absolute inset-0 rounded-lg flex overflow-hidden" style={{ background: "#EDE8DC" }}>
                  {/* Minara mascot — top right, like the website */}
                  <img
                    src="/assets/minara-mascot.png"
                    alt="Minara"
                    className="absolute pointer-events-none select-none"
                    style={{ right: 0, top: 0, height: "65%", opacity: 0.85, objectFit: "contain", objectPosition: "top right" }}
                  />

                  {/* Content */}
                  <div className="relative z-10 w-full flex flex-col justify-between p-5 sm:p-7">
                    {/* Top: branding */}
                    <div>
                      <p className="text-[10px] sm:text-xs font-bold tracking-[0.3em] mb-2" style={{ color: "#C8C3BA" }}>
                        MINARA AI PRESENTS
                      </p>
                      <div className="mb-1">
                        <span className="block font-black tracking-tight leading-none"
                          style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(2rem, 6vw, 3.5rem)", color: "#1C1A18" }}>
                          Zombie
                        </span>
                        <span className="block font-black tracking-tight leading-none"
                          style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(2rem, 6vw, 3.5rem)", color: "#1C1A18", fontStyle: "italic" }}>
                          Defender
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm mt-2" style={{ color: "#C8C3BA", maxWidth: 260 }}>
                        Defend the AI frontier. Shoot the corrupted bots.
                      </p>
                    </div>

                    {/* Bottom: character select + play */}
                    <div className="w-full max-w-sm">
                      {/* Selected character preview */}
                      <div className="flex items-end gap-4 mb-4">
                        <div style={{ width: 80, height: 90, flexShrink: 0, position: "relative" }}>
                          <img
                            key={CHARACTERS[selectedChar].shooterSrc}
                            src={CHARACTERS[selectedChar].shooterSrc}
                            alt={CHARACTERS[selectedChar].name}
                            style={{ width: "100%", height: "100%", objectFit: "contain" }}
                          />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold tracking-widest uppercase mb-0.5" style={{ color: "#C8C3BA" }}>Selected</p>
                          <p className="font-black text-base" style={{ color: "#1C1A18", fontFamily: "'Playfair Display', serif" }}>{CHARACTERS[selectedChar].name}</p>
                        </div>
                      </div>

                      {/* Character select grid */}
                      <div className="rounded-xl border overflow-hidden mb-3" style={{ borderColor: "#C8C3BA", background: "#F2EDE3" }}>
                        <p className="text-[10px] font-black tracking-widest uppercase text-center py-1.5 border-b"
                          style={{ color: "#1C1A18", background: "#E8E2D6", borderColor: "#C8C3BA" }}>
                          ⚡ Choose Your AI
                        </p>
                        <div className="flex justify-center gap-2 p-3 flex-wrap">
                          {CHARACTERS.map((c, i) => (
                            <button
                              key={c.id}
                              onClick={() => { setSelectedChar(i); selectedCharRef.current = i; }}
                              title={c.name}
                              className="flex flex-col items-center gap-1 transition-all"
                              style={{ outline: "none" }}
                            >
                              <div className="rounded-lg overflow-hidden transition-all"
                                style={{
                                  width: 52, height: 52,
                                  border: selectedChar === i ? "2.5px solid #1C1A18" : "2px solid #D4CFC4",
                                  background: "#FFFFFF",
                                  transform: selectedChar === i ? "scale(1.1)" : "scale(1)",
                                  boxShadow: selectedChar === i ? "0 2px 8px rgba(28,26,24,0.18)" : "none",
                                }}>
                                <img src={c.src} alt={c.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                              </div>
                              <span className="text-[9px] font-bold"
                                style={{ color: selectedChar === i ? "#1C1A18" : "#C8C3BA" }}>
                                {c.name}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Controls hint */}
                      {isMobile ? (
                        <p className="text-[11px] mb-3" style={{ color: "#C8C3BA" }}>Hold ◀ ▶ to move · gun fires automatically</p>
                      ) : (
                        <p className="text-[11px] mb-3" style={{ color: "#C8C3BA" }}>
                          <kbd className="px-1 py-0.5 rounded text-xs font-bold" style={{ background: "#E8E2D6", color: "#1C1A18", border: "1px solid #C8C3BA" }}>A</kbd>{" / "}
                          <kbd className="px-1 py-0.5 rounded text-xs font-bold" style={{ background: "#E8E2D6", color: "#1C1A18", border: "1px solid #C8C3BA" }}>D</kbd>
                          {" or arrows to move · "}
                          <kbd className="px-1 py-0.5 rounded text-xs font-bold" style={{ background: "#E8E2D6", color: "#1C1A18", border: "1px solid #C8C3BA" }}>Click</kbd>
                          {" to shoot"}
                        </p>
                      )}

                      {/* Play buttons */}
                      <div className="flex flex-col gap-2">
                        {loggedIn && canPlay && (
                          <button onClick={startGame}
                            className="font-black py-3 rounded-lg text-sm tracking-widest uppercase transition w-full"
                            style={{ background: "#1C1A18", color: "#EDE8DC" }}>
                            → Launch Defense
                          </button>
                        )}
                        {loggedIn && !canPlay && (
                          <div className="text-sm px-6 py-3 rounded-lg text-center font-black tracking-widest uppercase border"
                            style={{
                              background: tournamentStatus === "upcoming" ? "#fef9c3" : tournamentStatus === "ended" ? "#fee2e2" : "#F2EDE3",
                              borderColor: tournamentStatus === "upcoming" ? "#ca8a04" : tournamentStatus === "ended" ? "#dc2626" : "#C8C3BA",
                              color: tournamentStatus === "upcoming" ? "#854d0e" : tournamentStatus === "ended" ? "#b91c1c" : "#C8C3BA",
                            }}>
                            {tournamentStatus === "upcoming"
                              ? `⏳ ${timeLeft} until start`
                              : tournamentStatus === "ended"
                              ? "🏆 Tournament ended · Check leaderboard →"
                              : "No active tournament"}
                          </div>
                        )}
                        {!loggedIn && (
                          <button onClick={startDemoGame}
                            className="font-black py-2.5 rounded-lg text-sm tracking-widest uppercase border transition w-full"
                            style={{ background: "transparent", borderColor: "#1C1A18", color: "#1C1A18" }}>
                            🎮 Play Demo
                          </button>
                        )}
                        {!loggedIn && (
                          <p className="text-[10px] text-center" style={{ color: "#C8C3BA" }}>
                            Scores not saved ·{" "}
                            <span className="cursor-pointer underline" style={{ color: "#1C1A18" }} onClick={() => setShowSidebar(true)}>Login</span>
                            {" "}to compete
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Game Over */}
              {gameState === "over" && (
                <div className="absolute inset-0 rounded-lg flex items-center justify-center" style={{ background: "#EDE8DC" }}>
                  <div className="relative z-10 rounded-xl p-6 sm:p-10 text-center w-72 sm:w-80 border"
                    style={{ background: "#F2EDE3", borderColor: tournamentEndedWhilePlaying ? "#ca8a04" : "#1C1A18", borderWidth: "1.5px" }}>
                    {tournamentEndedWhilePlaying ? (
                      <h2 className="text-2xl sm:text-3xl font-black tracking-widest mb-2" style={{ fontFamily: "'Playfair Display', serif", color: "#854d0e" }}>🏆 TOURNAMENT<br/>ENDED!</h2>
                    ) : (
                      <h2 className="text-3xl sm:text-4xl font-black tracking-widest mb-2" style={{ fontFamily: "'Playfair Display', serif", color: "#1C1A18" }}>Game Over</h2>
                    )}
                    <p className="font-black my-3" style={{ fontSize: "3.5rem", color: "#1C1A18", fontFamily: "'Playfair Display', serif" }}>{score}</p>
                    <p className="text-sm mb-5" style={{ color: "#C8C3BA" }}>Final Score</p>
                    {devtoolsWarning && (
                      <p className="text-red-600 text-xs mb-4 bg-red-50 border border-red-300 rounded p-2">
                        Score invalidated — DevTools detected.
                      </p>
                    )}

                    {/* Score submission status */}
                    {playMode === "tournament" && !devtoolsWarning && (
                      <div className="mb-4">
                        {submitting && (
                          <p className="text-xs rounded px-3 py-2 animate-pulse" style={{ color: "#1C1A18", background: "#E8E2D6", border: "1px solid #C8C3BA" }}>
                            ⏳ Saving your score...
                          </p>
                        )}
                        {submitted && !submitting && (
                          <p className="text-xs bg-green-50 border border-green-300 text-green-700 rounded px-3 py-2">
                            ✅ Score saved to leaderboard!
                          </p>
                        )}
                        {submitError && !submitting && !submitted && (
                          <div className="text-red-600 text-xs bg-red-50 border border-red-300 rounded px-3 py-2">
                            <p className="mb-2">❌ {submitError}</p>
                            <button
                              onClick={autoSubmitScore}
                              className="w-full font-bold py-1.5 rounded tracking-wider uppercase text-xs transition"
                              style={{ background: "#1C1A18", color: "#EDE8DC" }}>
                              Retry Submit
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {playMode === "demo" ? (
                      <div className="mb-4">
                        <p className="text-xs mb-3 rounded px-3 py-2" style={{ color: "#C8C3BA", border: "1px solid #D4CFC4" }}>
                          🎮 Demo mode — score not saved
                        </p>
                        {!loggedIn && (
                          <p className="text-xs mb-3" style={{ color: "#E8729A" }}>Login to compete on the leaderboard!</p>
                        )}
                      </div>
                    ) : null}
                    {playMode === "demo" ? (
                      <button onClick={startDemoGame}
                        className="w-full font-bold py-2 rounded tracking-wider uppercase text-sm transition mb-2"
                        style={{ background: "#1C1A18", color: "#EDE8DC" }}>
                        Play Again (Demo)
                      </button>
                    ) : (
                      canPlay && !devtoolsWarning && (
                        <button onClick={startGame}
                          className="w-full font-bold py-2 rounded tracking-wider uppercase text-sm transition mb-2"
                          style={{ background: "#1C1A18", color: "#EDE8DC" }}>
                          Play Again
                        </button>
                      )
                    )}
                    <button onClick={() => { setGameState("menu"); setPlayMode(null); }}
                      className="w-full font-bold py-1.5 rounded tracking-wider uppercase text-xs transition"
                      style={{ background: "transparent", color: "#C8C3BA", border: "1px solid #D4CFC4" }}>
                      Back to Menu
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar — desktop: always visible | mobile: overlay when showSidebar */}
        {!isMobile ? (
          <div className="w-44 sm:w-52 flex-shrink-0 min-h-0">
            {renderSidebar()}
          </div>
        ) : showSidebar ? (
          <div className="absolute inset-0 z-50 flex items-start justify-end p-2" style={{ background: "rgba(0,0,0,0.7)" }}
            onClick={e => { if (e.target === e.currentTarget) setShowSidebar(false); }}>
            <div className="w-64 max-h-full overflow-y-auto rounded-lg">
              {renderSidebar()}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
