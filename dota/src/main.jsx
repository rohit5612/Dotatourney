import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { applyClientMetaTags } from "./constants/siteMeta.js";
import { applyPublicThemeDocument } from "./utils/applyPublicThemeDocument.js";
import "./index.css";
import "./styles/cta-emerald-profile.css";

import App from "./App.jsx";

applyClientMetaTags();
applyPublicThemeDocument();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
