import { useEffect, useState } from "react";
import { rpcCall } from "../../core/rpc/client";
import type { BankSummary } from "../../core/mdt/types";

function money(n: number): string {
  return n.toLocaleString("hu-HU");
}

export default function BankApp() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<BankSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const res = await rpcCall("bank:getSummary", {}, { timeoutMs: 2500 });
      setSummary(res.summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  return (
    <div>
      <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 10 }}>Bank</div>
      {loading && <div style={{ opacity: 0.75 }}>Betöltés…</div>}
      {error && <div style={{ opacity: 0.85 }}>Hiba: {error}</div>}

      {summary && (
        <div style={{ border: "1px solid rgba(255,255,255,0.10)", background: "rgba(0,0,0,0.16)", padding: 12 }}>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            <div><div style={{ opacity: 0.7, fontSize: 12 }}>Készpénz</div><div style={{ fontWeight: 900 }}>{money(summary.cash)} $</div></div>
            <div><div style={{ opacity: 0.7, fontSize: 12 }}>Bankszámla</div><div style={{ fontWeight: 900 }}>{money(summary.bank)} $</div></div>
            <div><div style={{ opacity: 0.7, fontSize: 12 }}>IBAN</div><div style={{ fontWeight: 900 }}>{summary.iban ?? "—"}</div></div>
          </div>
          <div style={{ marginTop: 12 }}><button className="hpx-btn" onClick={() => void load()}>Frissítés</button></div>
          <div style={{ marginTop: 10, opacity: 0.65, fontSize: 12 }}>(TODO: HPX bank modul integráció export/DB alapján.)</div>
        </div>
      )}
    </div>
  );
}
