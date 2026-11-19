import { createRoot } from "react-dom/client";
import GameApp from "./game/GameApp";
import "./game/game.css";

createRoot(document.getElementById("root")!).render(<GameApp />);
