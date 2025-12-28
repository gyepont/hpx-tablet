import { useMemo, useState } from "react";
import { rpcCall } from "../../core/rpc/client";
import { usePlayerContext } from "../../core/session/usePlayerContext";

export default function ProfileApp() {
  const { data, loading, error, refresh } = usePlayerContext();
  const [busy, setBusy] = useState(false);

  const roleLabel = useMemo(() => {
    const r = data?.role ?? "civ";
    if (r === "police") return "Rendőrség";
    if (r === "ems") return "Mentő";
    if (r === "admin") return "Admin";
    return "Civil";
  }, [data?.role]);

  async function toggleDuty() {
    if (!data) return;

    setBusy(true);
    try {
      await rpcCall("tablet:setDuty", { duty: !data.duty }, { timeoutMs: 2500 });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 10 }}>Profil</div>

      {loading && <div style={{ opacity: 0.75 }}>Betöltés…</div>}
      {error && <div style={{ opacity: 0.85 }}>Hiba: {error}</div>}

      {data && (
        <div
          style={{
            border: "1px solid rgba(255,255,255,0.10)",
            background: "rgba(0,0,0,0.18)",
            padding: 12,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>Név</div>
              <div style={{ fontWeight: 900 }}>{data.name}</div>
            </div>

            <div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>Szerver ID</div>
              <div style={{ fontWeight: 900 }}>{data.serverId}</div>
            </div>

            <div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>Szerepkör</div>
              <div style={{ fontWeight: 900 }}>{roleLabel}</div>
            </div>

            <div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>Munka</div>
              <div style={{ fontWeight: 900 }}>{data.jobLabel}</div>
            </div>

            <div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>Hívójel</div>
              <div style={{ fontWeight: 900 }}>{data.callsign ?? "—"}</div>
            </div>

            <div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>Szolgálat</div>
              <div style={{ fontWeight: 900 }}>{data.duty ? "SZOLGÁLATBAN" : "NINCS SZOLGÁLATBAN"}</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
            <button className="hpx-btn" onClick={() => void refresh()} disabled={busy}>
              Frissítés
            </button>

            <button className="hpx-btn hpx-btnAccent" onClick={toggleDuty} disabled={busy}>
              {busy ? "Dolgozom…" : data.duty ? "Szolgálat vége" : "Szolgálat kezdete"}
            </button>
          </div>

          <div style={{ marginTop: 10, opacity: 0.65, fontSize: 12 }}>
            (Ez most demo: később a duty-t a rendőrségi/EMS rendszerrel kötjük össze.)
          </div>
        </div>
      )}
    </div>
  );
}
