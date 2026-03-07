import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// The popup re-uses the same App as the panel —
// swap this import if you want a different popup UI.
import App from "../panel/App";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
