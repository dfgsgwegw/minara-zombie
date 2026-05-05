const WARN_MSG = "⚠️ Tournament is monitored. Score manipulation will disqualify you.";

export function lockConsole() {
  if (import.meta.env.DEV) return;

  const noop = () => {};
  const warnFn = () => { try { window.alert(WARN_MSG); } catch {} };
  const methods = ["log", "debug", "info", "table", "dir", "dirxml", "trace", "error"] as const;

  methods.forEach((m) => {
    try {
      Object.defineProperty(console, m, {
        value: m === "warn" ? warnFn : noop,
        writable: false,
        configurable: false,
      });
    } catch {
      try { (console as Record<string, unknown>)[m] = noop; } catch {}
    }
  });
}

export function detectDevTools(onOpen: () => void): () => void {
  if (import.meta.env.DEV) return () => {};

  let open = false;

  function check() {
    const widthDiff = window.outerWidth - window.innerWidth;
    const heightDiff = window.outerHeight - window.innerHeight;
    const nowOpen = widthDiff > 160 || heightDiff > 160;
    if (nowOpen && !open) { open = true; onOpen(); }
    if (!nowOpen) open = false;
  }

  const id = setInterval(check, 1000);
  window.addEventListener("resize", check);
  return () => { clearInterval(id); window.removeEventListener("resize", check); };
}

export function disableRightClick() {
  if (import.meta.env.DEV) return;
  document.addEventListener("contextmenu", (e) => e.preventDefault());
}

export function disableKeyboardShortcuts() {
  if (import.meta.env.DEV) return;
  document.addEventListener("keydown", (e) => {
    if (
      e.key === "F12" ||
      (e.ctrlKey && e.shiftKey && ["I", "J", "C", "K"].includes(e.key)) ||
      (e.ctrlKey && e.key === "U") ||
      (e.metaKey && e.altKey && ["I", "J", "C"].includes(e.key))
    ) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);
}
