import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { lockConsole, disableRightClick, disableKeyboardShortcuts } from "./lib/anticheats";

lockConsole();
disableRightClick();
disableKeyboardShortcuts();

createRoot(document.getElementById("root")!).render(<App />);
