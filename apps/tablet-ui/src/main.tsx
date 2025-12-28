import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/hpx.css";

/** Hibák kiírása az oldalon is (ne kelljen DevTools) */
function installErrorOverlay(): void {
  const el = document.createElement("div");
  el.id = "hpx-error-overlay";
  el.style.position = "fixed";
  el.style.left = "12px";
  el.style.bottom = "12px";
  el.style.maxWidth = "680px";
  el.style.padding = "10px 12px";
  el.style.borderRadius = "12px";
  el.style.fontSize = "12px";
  el.style.whiteSpace = "pre-wrap";
  el.style.background = "rgba(0,0,0,0.75)";
  el.style.border = "1px solid rgba(255,216,76,0.28)";
  el.style.color = "rgba(255,255,255,0.92)";
  el.style.display = "none";
  el.style.zIndex = "999999";
  document.body.appendChild(el);

  const show = (title: string, err: unknown) => {
    el.style.display = "block";
    const msg = err instanceof Error ? `${err.message}\n${err.stack ?? ""}` : String(err);
    el.textContent = `[${title}]\n${msg}`;
  };

  window.addEventListener("error", (e) => show("window.error", e.error ?? e.message));
  window.addEventListener("unhandledrejection", (e) => show("unhandledrejection", e.reason));
}

installErrorOverlay();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
