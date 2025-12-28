import { useMemo, useState } from "react";
import { getRpcTransportKind, rpcCall } from "../../core/rpc/client";
import { WALLPAPERS, type WallpaperId } from "../../core/ui/wallpapers";
import { useLocalStorageState } from "../../core/ui/useLocalStorage";

function isLikelyUrl(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export default function SettingsApp() {
  const transport = useMemo(() => getRpcTransportKind(), []);
  const [busy, setBusy] = useState(false);
  const [output, setOutput] = useState<string>("");

  const [wallpaperId, setWallpaperId] = useLocalStorageState<WallpaperId>("hpx.tablet.wallpaper", "hpx-amber");
  const [customWallpaperUrl, setCustomWallpaperUrl] = useLocalStorageState<string>("hpx.tablet.wallpaperUrl", "");
  const [urlInput, setUrlInput] = useState<string>(customWallpaperUrl);

  const urlOk = isLikelyUrl(urlInput);

  async function handlePing() {
    setBusy(true);
    setOutput("");
    try {
      const res = await rpcCall("tablet:ping", { message: "HPX Tablet ping" }, { timeoutMs: 3000 });
      setOutput(JSON.stringify(res, null, 2));
    } catch (e) {
      const msg = e instanceof Error ? `${e.message}\n${e.stack ?? ""}` : String(e);
      setOutput(msg);
    } finally {
      setBusy(false);
    }
  }

  async function handleGetState() {
    setBusy(true);
    setOutput("");
    try {
      const res = await rpcCall("tablet:getState", {}, { timeoutMs: 3000 });
      setOutput(JSON.stringify(res, null, 2));
    } catch (e) {
      const msg = e instanceof Error ? `${e.message}\n${e.stack ?? ""}` : String(e);
      setOutput(msg);
    } finally {
      setBusy(false);
    }
  }

  function getTransportLabel(): string {
    return transport === "mock" ? "WEB/DEV (mock)" : "FIVEM NUI";
  }

  function applyCustomUrl(): void {
    // Magyar komment: elmentjük és átváltunk custom háttérre
    setCustomWallpaperUrl(urlInput.trim());
    setWallpaperId("custom-url");
  }

  return (
    <div>
      <div style={{ fontWeight: 800, marginBottom: 10 }}>Beállítások</div>

      <div
        style={{
          padding: 12,
          borderRadius: 0,
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(0,0,0,0.22)",
          marginBottom: 12,
        }}
      >
        <div style={{ opacity: 0.8, fontSize: 13, marginBottom: 10 }}>
          Kapcsolat mód: <span style={{ fontWeight: 800 }}>{getTransportLabel()}</span>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          <button className="hpx-btn" onClick={handlePing} disabled={busy}>
            {busy ? "Dolgozom…" : "Szerver ping"}
          </button>

          <button className="hpx-btn" onClick={handleGetState} disabled={busy}>
            {busy ? "Dolgozom…" : "Állapot lekérés"}
          </button>
        </div>

        <div style={{ fontWeight: 800, marginBottom: 8 }}>Háttér (Home)</div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          {WALLPAPERS.map((w) => (
            <button
              key={w.id}
              className="hpx-btn"
              onClick={() => setWallpaperId(w.id)}
              style={{
                borderColor: wallpaperId === w.id ? "rgba(255,216,76,0.40)" : "rgba(255,255,255,0.12)",
                boxShadow: wallpaperId === w.id ? "0 0 0 3px rgba(255,216,76,0.10)" : "none",
              }}
            >
              {w.nameHu}
            </button>
          ))}
        </div>

        <div style={{ fontWeight: 800, marginBottom: 8 }}>Egyedi háttérkép URL</div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://..."
            style={{
              width: "min(560px, 100%)",
              padding: "10px 10px",
              borderRadius: 0,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(0,0,0,0.18)",
              color: "rgba(255,255,255,0.92)",
              outline: "none",
            }}
          />

          <button
            className="hpx-btn hpx-btnAccent"
            onClick={applyCustomUrl}
            disabled={!urlOk}
            style={{ opacity: urlOk ? 1 : 0.55 }}
            title={urlOk ? "Mentés és alkalmazás" : "Adj meg egy érvényes http/https URL-t"}
          >
            Mentés
          </button>

          <div style={{ opacity: 0.7, fontSize: 12 }}>{urlOk ? "OK" : "Csak http/https link"}</div>
        </div>

        <div style={{ marginTop: 8, opacity: 0.7, fontSize: 12 }}>
          Tipp: közvetlen kép link (jpg/png/webp) a legbiztosabb.
        </div>
      </div>

      <pre
        style={{
          margin: 0,
          padding: 12,
          borderRadius: 0,
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(0,0,0,0.25)",
          color: "rgba(255,255,255,0.90)",
          minHeight: 160,
          overflow: "auto",
          fontSize: 12,
          lineHeight: 1.45,
        }}
      >
        {output || "—"}
      </pre>
    </div>
  );
}
