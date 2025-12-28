import { useEffect, useMemo, useState } from "react";
import { rpcCall } from "../../core/rpc/client";
import type { MdtPerson, MdtReport, MdtReportInvolved, MdtReportType } from "../../core/mdt/types";
import { usePlayerContext } from "../../core/session/usePlayerContext";

function notify(title: string, message: string, level: "info" | "success" | "warning" | "error" = "info") {
  window.postMessage({ type: "hpx:notify", title, message, level }, "*");
}

export default function PersonApp() {
  const { data: player } = usePlayerContext();
  const actorCid = player?.serverId ?? 0;
  const actorName = player?.name ?? "—";

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MdtPerson[]>([]);
  const [selectedCid, setSelectedCid] = useState<number | null>(null);
  const [selected, setSelected] = useState<MdtPerson | null>(null);

  const [reports, setReports] = useState<MdtReport[]>([]);
  const [loading, setLoading] = useState(false);

  const selectedReports = useMemo(() => {
    if (!selectedCid) return [];
    return reports.filter((r) => r.involved.some((i) => i.cid === selectedCid));
  }, [reports, selectedCid]);

  async function loadReports(): Promise<void> {
    const res = await rpcCall("mdt:getReports", { limit: 400, type: "ALL" }, { timeoutMs: 3000 });
    setReports(res.reports);
  }

  async function search(): Promise<void> {
    setLoading(true);
    try {
      const res = await rpcCall("mdt:searchPerson", { query: query.trim(), limit: 25 }, { timeoutMs: 2500 });
      setResults(res.persons);
    } finally {
      setLoading(false);
    }
  }

  async function openPerson(cid: number): Promise<void> {
    setSelectedCid(cid);
    const res = await rpcCall("mdt:getPerson", { cid }, { timeoutMs: 2500 });
    setSelected(res.person);
    await loadReports();
  }

  async function createReportForPerson(): Promise<void> {
    if (!selected) return;

    const title = prompt("Jelentés címe:", `Igazoltatás – ${selected.name}`) ?? "";
    if (!title.trim()) return;

    const type: MdtReportType = "Igazoltatás";
    const involved: MdtReportInvolved[] = [{ cid: selected.cid, name: selected.name, role: "Egyéb" }];

    const res = await rpcCall(
      "mdt:createReport",
      {
        type,
        title: title.trim(),
        location: "—",
        tags: ["Igazoltatás"],
        involved,
        fullText: `<p><b>Érintett:</b> ${selected.name} (CID: ${selected.cid})</p><p></p>`,
        actorCid,
        actorName,
      },
      { timeoutMs: 3000 }
    );

    notify("Jelentések", `Létrehozva: ${res.report.id}`, "success");
    await loadReports();
  }

  useEffect(() => {
    void loadReports();
  }, []);

  return (
    <div>
      <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 10 }}>Személy</div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Név vagy CID…"
          style={{
            width: "min(420px, 100%)",
            padding: "10px 10px",
            borderRadius: 0,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(0,0,0,0.18)",
            color: "rgba(255,255,255,0.92)",
            outline: "none",
          }}
        />
        <button className="hpx-btn hpx-btnAccent" onClick={() => void search()} disabled={loading}>
          {loading ? "Keresés…" : "Keresés"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "0.9fr 1.1fr", gap: 12 }}>
        <div style={{ border: "1px solid rgba(255,255,255,0.10)", background: "rgba(0,0,0,0.16)", padding: 12 }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Találatok</div>

          {results.length === 0 ? (
            <div style={{ opacity: 0.7 }}>—</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {results.map((p) => (
                <div
                  key={p.cid}
                  style={{ border: "1px solid rgba(255,255,255,0.10)", padding: 10, cursor: "pointer" }}
                  onClick={() => void openPerson(p.cid)}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ fontWeight: 900 }}>{p.name}</div>
                    <div style={{ opacity: 0.7 }}>CID: {p.cid}</div>
                  </div>
                  <div style={{ opacity: 0.75, fontSize: 12, marginTop: 6 }}>
                    Telefon: {p.phone ?? "—"} • Munka: {p.job ?? "—"}
                  </div>
                  {p.flags && p.flags.length > 0 && (
                    <div style={{ opacity: 0.75, fontSize: 12, marginTop: 6 }}>
                      Flag: {p.flags.join(", ")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ border: "1px solid rgba(255,255,255,0.10)", background: "rgba(0,0,0,0.16)", padding: 12 }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Profil</div>

          {!selected ? (
            <div style={{ opacity: 0.7 }}>Válassz egy személyt.</div>
          ) : (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ opacity: 0.7, fontSize: 12 }}>Név</div>
                  <div style={{ fontWeight: 900 }}>{selected.name}</div>
                </div>

                <div>
                  <div style={{ opacity: 0.7, fontSize: 12 }}>CID</div>
                  <div style={{ fontWeight: 900 }}>{selected.cid}</div>
                </div>

                <div>
                  <div style={{ opacity: 0.7, fontSize: 12 }}>Telefon</div>
                  <div style={{ fontWeight: 900 }}>{selected.phone ?? "—"}</div>
                </div>

                <div>
                  <div style={{ opacity: 0.7, fontSize: 12 }}>Munka</div>
                  <div style={{ fontWeight: 900 }}>{selected.job ?? "—"}</div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                <button className="hpx-btn hpx-btnAccent" onClick={() => void createReportForPerson()}>
                  Új jelentés ehhez
                </button>
                <button className="hpx-btn" onClick={() => void loadReports()}>
                  Jelentések frissítése
                </button>
              </div>

              <div style={{ fontWeight: 900, marginTop: 14, marginBottom: 8 }}>
                Kapcsolt jelentések ({selectedReports.length})
              </div>

              {selectedReports.length === 0 ? (
                <div style={{ opacity: 0.7 }}>Nincs kapcsolt jelentés.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {selectedReports.slice(0, 20).map((r) => (
                    <div key={r.id} style={{ border: "1px solid rgba(255,255,255,0.10)", padding: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                        <div style={{ fontWeight: 900 }}>{r.type} • {r.title}</div>
                        <div style={{ opacity: 0.7, fontSize: 12 }}>ID: {r.id}</div>
                      </div>
                      <div style={{ opacity: 0.75, fontSize: 12, marginTop: 6 }}>
                        Tagek: {r.tags.join(", ") || "—"} • Helyszín: {r.location}
                      </div>
                      <div style={{ opacity: 0.85, fontSize: 12, marginTop: 6 }}>
                        {r.summary}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginTop: 10, opacity: 0.65, fontSize: 12 }}>
                Következő: jogosítványok, körözés, járművek, kapcsolatok.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
