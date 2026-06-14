import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { applyClientMetaTags } from "./constants/siteMeta.js";
import { applyPublicThemeDocument } from "./utils/applyPublicThemeDocument.js";
import { unregisterStaleServiceWorkers } from "./utils/unregisterStaleServiceWorkers.js";
import "./index.css";
import "./styles/cta-emerald-profile.css";

import App from "./App.jsx";

applyClientMetaTags();
applyPublicThemeDocument();
unregisterStaleServiceWorkers();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
