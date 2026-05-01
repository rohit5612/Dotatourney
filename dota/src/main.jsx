import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { applyClientMetaTags } from "./constants/siteMeta.js";
import "./index.css";
import App from "./App.jsx";

applyClientMetaTags();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
