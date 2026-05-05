import { useEffect, useState } from "react";
import { isLoggedIn, getAuth } from "@/lib/auth";
import LoginPage from "@/pages/login";
import GamePage from "@/pages/game";
import AdminPage from "@/pages/admin";

function getRoute(): "game" | "admin" {
  return window.location.pathname.replace(/\/$/, "").endsWith("/admin")
    ? "admin"
    : "game";
}

export default function App() {
  const [route, setRoute] = useState<"game" | "admin">(getRoute);
  const [loggedIn, setLoggedIn] = useState(isLoggedIn);

  useEffect(() => {
    function onPop() { setRoute(getRoute()); }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  function navigate(path: string) {
    window.history.pushState({}, "", path);
    setRoute(getRoute());
  }

  if (route === "admin") {
    if (!loggedIn) {
      return <LoginPage onLogin={() => setLoggedIn(true)} adminMode={true} />;
    }
    const user = getAuth();
    if (!user?.isAdmin) {
      return (
        <div className="min-h-screen bg-black flex items-center justify-center flex-col gap-4">
          <p className="text-red-400 font-black text-2xl tracking-widest">ACCESS DENIED</p>
          <p className="text-white/40 text-sm">This page is for administrators only.</p>
          <button
            onClick={() => navigate("/")}
            className="text-green-400 text-sm border border-green-500/30 px-4 py-2 rounded hover:border-green-400 transition mt-2"
          >
            Back to Game
          </button>
        </div>
      );
    }
    return <AdminPage onBack={() => navigate("/")} />;
  }

  return (
    <GamePage
      loggedIn={loggedIn}
      onLogin={() => setLoggedIn(true)}
      onLogout={() => {
        setLoggedIn(false);
        navigate("/");
      }}
    />
  );
}
