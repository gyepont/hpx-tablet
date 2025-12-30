import { useMemo, useState } from "react";
import { useLocalStorageState } from "../../core/ui/useLocalStorage";
import type { CaseItem, CasePriority, CaseStatus } from "../../core/cases/types";
import { createCaseDraft, touchCase } from "../../core/cases/storage";

type Props = { mode?: "app" | "embedded" };

const STORAGE_KEY = "hpx:cases:v1";

const STATUSES: (CaseStatus | "ALL")[] = ["ALL", "Nyitott", "Folyamatban", "Vádemelés", "Lezárt"];
const PRIORITIES: CasePriority[] = ["Alacsony", "Közepes", "Magas", "Kritikus"];

function normalizeTags(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 25);
}

function normalizeIds(raw: string): string[] {
  return raw
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 200);
}

export default function CasesApp(props: Props) {
  const mode = props.mode ?? "app";

  const [cases, setCases] = useLocalStorageState<CaseItem[]>(STORAGE_KEY, []);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<CaseStatus | "ALL">("ALL");

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useMemo(() => (selectedId ? cases.find((c) => c.id === selectedId) ?? null : null), [cases, selectedId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cases
      .filter((c) => (statusFilter === "ALL" ? true : c.status === statusFilter))
      .filter((c) => {
        if (!q) return true;
        return (
          c.caseNumber.toLowerCase().includes(q) ||
          c.title.toLowerCase().includes(q) ||
          c.location.toLowerCase().includes(q) ||
          c.tags.join(",").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }, [cases, query, statusFilter]);

  function createCase() {
    const title = (prompt("Ügy címe:", "") ?? "").trim();
    if (!title) return;

    const draft = createCaseDraft({ title, location: "—" });
    setCases((prev) => [draft, ...prev]);
    setSelectedId(draft.id);
  }

  function updateSelected(patch: Partial<CaseItem>) {
    if (!selected) return;
    setCases((prev) =>
      prev.map((c) => (c.id === selected.id ? touchCase({ ...c, ...patch }) : c))
    );
  }

  return (
    <div style={{ padding: mode === "embedded" ? 0 : 12 }}>
      {mode === "app" && <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 10 }}>Ügyek</div>}

      <div style={{ display: "grid", gridTemplateColumns: "0.9fr 1.1fr", gap: 12 }}>
        <div style={{ border: "1px solid rgba(255,255,255,0.10)", background: "rgba(0,0,0,0.16)", padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            <div style={{ fontWeight: 900 }}>Lista</div>
            <button className="hpx-btn hpx-btnAccent" onClick={createCase}>Új ügy</button>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Keresés (iktatószám/cím/tag)…"
              style={{
                width: "min(320px, 100%)",
                padding: "10px 10px",
                borderRadius: 0,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(0,0,0,0.18)",
                color: "rgba(255,255,255,0.92)",
                outline: "none",
              }}
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as CaseStatus | "ALL")}
              style={{
                padding: "10px 10px",
                borderRadius: 0,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(0,0,0,0.18)",
                color: "rgba(255,255,255,0.92)",
                outline: "none",
              }}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s === "ALL" ? "Minden státusz" : s}</option>
              ))}
            </select>
          </div>

          {filtered.length === 0 ? (
            <div style={{ opacity: 0.7 }}>Nincs ügy.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filtered.slice(0, 60).map((c) => (
                <div
                  key={c.id}
                  style={{
                    border: "1px solid rgba(255,255,255,0.10)",
                    padding: 10,
                    cursor: "pointer",
                    boxShadow: selectedId === c.id ? "0 0 0 3px rgba(255,216,76,0.10)" : "none",
                  }}
                  onClick={() => setSelectedId(c.id)}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 900 }}>{c.caseNumber}</div>
                    <div style={{ opacity: 0.75, fontSize: 12 }}>{c.status}</div>
                  </div>
                  <div style={{ marginTop: 6, fontWeight: 800 }}>{c.title}</div>
                  <div style={{ marginTop: 6, opacity: 0.75, fontSize: 12 }}>
                    Helyszín: {c.location} • Tagek: {c.tags.join(", ") || "—"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ border: "1px solid rgba(255,255,255,0.10)", background: "rgba(0,0,0,0.16)", padding: 12 }}>
          <div style={{ fontWeight: 900, marginBottom: 10 }}>Részletek</div>

          {!selected ? (
            <div style={{ opacity: 0.7 }}>Válassz egy ügyet.</div>
          ) : (
            <div>
              <div style={{ opacity: 0.75, fontSize: 12 }}>Iktatószám</div>
              <div style={{ fontWeight: 900, fontSize: 16 }}>{selected.caseNumber}</div>

              <div style={{ marginTop: 12, opacity: 0.7, fontSize: 12, marginBottom: 6 }}>Cím</div>
              <input
                value={selected.title}
                onChange={(e) => updateSelected({ title: e.target.value })}
                style={{ width: "100%", padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none" }}
              />

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
                <select
                  value={selected.status}
                  onChange={(e) => updateSelected({ status: e.target.value as CaseStatus })}
                  style={{ padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none" }}
                >
                  {STATUSES.filter((x) => x !== "ALL").map((s) => <option key={s} value={s}>{s}</option>)}
                </select>

                <select
                  value={selected.priority}
                  onChange={(e) => updateSelected({ priority: e.target.value as CasePriority })}
                  style={{ padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none" }}
                >
                  {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              <div style={{ marginTop: 10, opacity: 0.7, fontSize: 12, marginBottom: 6 }}>Helyszín</div>
              <input
                value={selected.location}
                onChange={(e) => updateSelected({ location: e.target.value })}
                style={{ width: "100%", padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none" }}
              />

              <div style={{ marginTop: 10, opacity: 0.7, fontSize: 12, marginBottom: 6 }}>Tagek (vesszővel)</div>
              <input
                value={selected.tags.join(", ")}
                onChange={(e) => updateSelected({ tags: normalizeTags(e.target.value) })}
                style={{ width: "100%", padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none" }}
              />

              <div style={{ marginTop: 10, opacity: 0.7, fontSize: 12, marginBottom: 6 }}>Leírás</div>
              <textarea
                value={selected.description}
                onChange={(e) => updateSelected({ description: e.target.value })}
                style={{ width: "100%", minHeight: 90, padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none" }}
              />

              <div style={{ marginTop: 12, opacity: 0.7, fontSize: 12, marginBottom: 6 }}>Linkelt report ID-k (vesszővel)</div>
              <input
                value={selected.linkedReportIds.join(", ")}
                onChange={(e) => updateSelected({ linkedReportIds: normalizeIds(e.target.value) })}
                style={{ width: "100%", padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none" }}
              />

              <div style={{ marginTop: 12, opacity: 0.7, fontSize: 12, marginBottom: 6 }}>Linkelt evidence ID-k (vesszővel)</div>
              <input
                value={selected.linkedEvidenceIds.join(", ")}
                onChange={(e) => updateSelected({ linkedEvidenceIds: normalizeIds(e.target.value) })}
                style={{ width: "100%", padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none" }}
              />

              <div style={{ marginTop: 12, opacity: 0.7, fontSize: 12 }}>
                (MVP) Később: report/evidence/bolo kattintható linkek + jogosultság + DB.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
