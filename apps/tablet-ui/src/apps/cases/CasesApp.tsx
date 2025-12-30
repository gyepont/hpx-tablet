import { useEffect, useMemo, useState } from "react";
import { useLocalStorageState } from "../../core/ui/useLocalStorage";

type CaseStatus = "NYITOTT" | "LEZÁRT";
type CasePriority = "Alacsony" | "Közepes" | "Magas" | "Kritikus";

type CaseEventAction =
  | "Létrehozva"
  | "Frissítve"
  | "Lezárva"
  | "Bizonyíték iktatva";

type CaseEvent = {
  id: string;
  ts: string;
  action: CaseEventAction;
  by: string;
  note?: string | null;
};

type CaseItem = {
  id: string; // iktatószám / ügyazonosító
  title: string;

  status: CaseStatus;
  priority: CasePriority;

  location: string;
  tags: string[];

  reportIds: string[];
  evidenceIds: string[];

  createdAt: string;
  updatedAt: string;

  timeline: CaseEvent[];
};

const CASES_KEY = "hpx:cases:v1";
const ACTIVE_CASE_KEY = "hpx:cases:activeCaseId:v1";
const LAST_OPEN_KEY = "hpx:cases:lastCaseId:v1";

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix = "HPX") {
  const d = new Date();
  const y = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const rnd = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}-${y}${mm}${dd}-${rnd}`;
}

function toast(title: string, message: string, level: "info" | "success" | "warning" | "error" = "info") {
  window.postMessage({ type: "hpx:notify", title, message, level }, "*");
}

function normalizeTags(s: string): string[] {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 24);
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function setActiveCaseId(id: string | null) {
  try {
    if (!id) localStorage.removeItem(ACTIVE_CASE_KEY);
    else localStorage.setItem(ACTIVE_CASE_KEY, JSON.stringify(id));
  } catch {
    // no-op
  }
}

function getActiveCaseId(): string | null {
  try {
    const raw = localStorage.getItem(ACTIVE_CASE_KEY);
    const v = safeParse<string | null>(raw, null);
    return v ? String(v) : null;
  } catch {
    return null;
  }
}

export default function CasesApp() {
  const [cases, setCases] = useLocalStorageState<CaseItem[]>(CASES_KEY, []);
  const [activeId, setActiveId] = useState<string | null>(() => getActiveCaseId());

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<CaseStatus | "ALL">("ALL");

  const selected = useMemo(() => cases.find((c) => c.id === activeId) ?? null, [cases, activeId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cases
      .filter((c) => (statusFilter === "ALL" ? true : c.status === statusFilter))
      .filter((c) => {
        if (!q) return true;
        return (
          c.id.toLowerCase().includes(q) ||
          c.title.toLowerCase().includes(q) ||
          c.location.toLowerCase().includes(q) ||
          c.tags.join(",").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }, [cases, query, statusFilter]);

  function selectCase(id: string) {
    setActiveId(id);
    setActiveCaseId(id);
  }

  function updateCase(id: string, patch: Partial<CaseItem>, event?: { action: CaseEventAction; note?: string | null }) {
    setCases((prev) => {
      const next = prev.map((c) => {
        if (c.id !== id) return c;
        const updated: CaseItem = {
          ...c,
          ...patch,
          updatedAt: nowIso(),
          timeline: event
            ? [
                { id: `${Date.now()}-${Math.random()}`, ts: nowIso(), action: event.action, by: "UI", note: event.note ?? null },
                ...c.timeline,
              ].slice(0, 80)
            : c.timeline,
        };
        return updated;
      });
      return next;
    });
  }

  function createNewCase() {
    const id = makeId("HPX");
    const createdAt = nowIso();

    const item: CaseItem = {
      id,
      title: "Új ügy",
      status: "NYITOTT",
      priority: "Közepes",
      location: "—",
      tags: [],
      reportIds: [],
      evidenceIds: [],
      createdAt,
      updatedAt: createdAt,
      timeline: [{ id: `${Date.now()}-${Math.random()}`, ts: createdAt, action: "Létrehozva", by: "UI", note: null }],
    };

    setCases((prev) => [item, ...prev]);
    selectCase(id);
    toast("Ügyek", `Ügy létrehozva: ${id}`, "success");
  }

  function saveNow() {
    if (!selected) return;
    updateCase(selected.id, {}, { action: "Frissítve", note: "Mentés" });
    toast("Ügyek", "Mentve.", "success");
  }

  function closeCase() {
    if (!selected) return;
    if (selected.status === "LEZÁRT") return;

    updateCase(selected.id, { status: "LEZÁRT" }, { action: "Lezárva", note: null });
    toast("Ügyek", "Ügy lezárva.", "success");
  }

  // Magyar komment: ha Evidence-ből “Ügy nyitása ebből” történt, ide rakjuk át a fókuszt
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LAST_OPEN_KEY);
      const id = safeParse<string | null>(raw, null);
      if (id && cases.some((c) => c.id === id)) {
        selectCase(id);
        localStorage.removeItem(LAST_OPEN_KEY);
      }
    } catch {
      // no-op
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isLocked = selected?.status === "LEZÁRT";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "420px 1fr", gap: 12 }}>
      <div style={{ border: "1px solid rgba(255,255,255,0.10)", background: "rgba(0,0,0,0.16)", padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>Ügyek</div>
          <button className="hpx-btn hpx-btnAccent" onClick={createNewCase}>
            Új ügy
          </button>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Keresés (iktató/cím/hely/tagek)…"
            style={{
              width: "min(360px, 100%)",
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
            onChange={(e) => setStatusFilter(e.target.value as any)}
            style={{
              padding: "10px 10px",
              borderRadius: 0,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(0,0,0,0.18)",
              color: "rgba(255,255,255,0.92)",
              outline: "none",
            }}
          >
            <option value="ALL">Minden</option>
            <option value="NYITOTT">Nyitott</option>
            <option value="LEZÁRT">Lezárt</option>
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
          {filtered.length === 0 ? (
            <div style={{ opacity: 0.7 }}>Nincs ügy.</div>
          ) : (
            filtered.map((c) => (
              <div
                key={c.id}
                onClick={() => selectCase(c.id)}
                style={{
                  border: "1px solid rgba(255,255,255,0.10)",
                  padding: 10,
                  cursor: "pointer",
                  boxShadow: activeId === c.id ? "0 0 0 3px rgba(255,216,76,0.10)" : "none",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 900 }}>{c.title}</div>
                  <div style={{ opacity: 0.75, fontSize: 12 }}>{c.status}</div>
                </div>
                <div style={{ opacity: 0.75, fontSize: 12, marginTop: 6 }}>
                  <b>{c.id}</b> • {c.priority} • {c.location}
                </div>
                <div style={{ opacity: 0.65, fontSize: 12, marginTop: 6 }}>
                  Bizonyíték: {c.evidenceIds.length} • Jelentés: {c.reportIds.length}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div style={{ border: "1px solid rgba(255,255,255,0.10)", background: "rgba(0,0,0,0.16)", padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 16 }}>Ügy részletek</div>
            <div style={{ opacity: 0.7, fontSize: 12 }}>
              Aktív ügy: <b>{activeId ?? "—"}</b>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="hpx-btn" onClick={saveNow} disabled={!selected}>
              Mentés
            </button>
            <button className="hpx-btn hpx-btnAccent" onClick={closeCase} disabled={!selected || selected?.status === "LEZÁRT"}>
              Lezárás
            </button>
          </div>
        </div>

        {!selected ? (
          <div style={{ opacity: 0.75, marginTop: 12 }}>Válassz egy ügyet bal oldalt.</div>
        ) : (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input
                value={selected.title}
                onChange={(e) => updateCase(selected.id, { title: e.target.value }, { action: "Frissítve", note: "Cím" })}
                disabled={isLocked}
                style={{
                  width: "min(520px, 100%)",
                  padding: "10px 10px",
                  borderRadius: 0,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(0,0,0,0.18)",
                  color: "rgba(255,255,255,0.92)",
                  outline: "none",
                  fontWeight: 900,
                }}
              />

              <select
                value={selected.priority}
                onChange={(e) => updateCase(selected.id, { priority: e.target.value as CasePriority }, { action: "Frissítve", note: "Prioritás" })}
                disabled={isLocked}
                style={{
                  padding: "10px 10px",
                  borderRadius: 0,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(0,0,0,0.18)",
                  color: "rgba(255,255,255,0.92)",
                  outline: "none",
                }}
              >
                <option value="Alacsony">Alacsony</option>
                <option value="Közepes">Közepes</option>
                <option value="Magas">Magas</option>
                <option value="Kritikus">Kritikus</option>
              </select>
            </div>

            <div style={{ marginTop: 10 }}>
              <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 6 }}>Helyszín</div>
              <input
                value={selected.location}
                onChange={(e) => updateCase(selected.id, { location: e.target.value }, { action: "Frissítve", note: "Helyszín" })}
                disabled={isLocked}
                style={{
                  width: "100%",
                  padding: "10px 10px",
                  borderRadius: 0,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(0,0,0,0.18)",
                  color: "rgba(255,255,255,0.92)",
                  outline: "none",
                }}
              />
            </div>

            <div style={{ marginTop: 10 }}>
              <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 6 }}>Tagek (vesszővel)</div>
              <input
                value={selected.tags.join(", ")}
                onChange={(e) => updateCase(selected.id, { tags: normalizeTags(e.target.value) }, { action: "Frissítve", note: "Tagek" })}
                disabled={isLocked}
                style={{
                  width: "100%",
                  padding: "10px 10px",
                  borderRadius: 0,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(0,0,0,0.18)",
                  color: "rgba(255,255,255,0.92)",
                  outline: "none",
                }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
              <div style={{ border: "1px solid rgba(255,255,255,0.10)", padding: 10 }}>
                <div style={{ fontWeight: 900, marginBottom: 8 }}>Bizonyítékok</div>
                {selected.evidenceIds.length === 0 ? (
                  <div style={{ opacity: 0.7 }}>—</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {selected.evidenceIds.slice(0, 30).map((id) => (
                      <div key={id} style={{ border: "1px solid rgba(255,255,255,0.10)", padding: 8 }}>
                        <div style={{ fontWeight: 900 }}>{id}</div>
                        <div style={{ opacity: 0.7, fontSize: 12 }}>
                          (Tipp) Nyisd meg a Bizonyítékok appot, és ez lesz a kontextus.
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ border: "1px solid rgba(255,255,255,0.10)", padding: 10 }}>
                <div style={{ fontWeight: 900, marginBottom: 8 }}>Jelentések</div>
                {selected.reportIds.length === 0 ? (
                  <div style={{ opacity: 0.7 }}>—</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {selected.reportIds.slice(0, 30).map((id) => (
                      <div key={id} style={{ border: "1px solid rgba(255,255,255,0.10)", padding: 8 }}>
                        <div style={{ fontWeight: 900 }}>{id}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>Timeline / Audit</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {selected.timeline.slice(0, 60).map((e) => (
                  <div key={e.id} style={{ border: "1px solid rgba(255,255,255,0.10)", padding: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ fontWeight: 900 }}>{e.action}</div>
                      <div style={{ opacity: 0.7, fontSize: 12 }}>{e.ts}</div>
                    </div>
                    <div style={{ opacity: 0.75, fontSize: 12 }}>
                      {e.by} {e.note ? `• ${e.note}` : ""}
                    </div>
                  </div>
                ))}
              </div>
              {isLocked && (
                <div style={{ marginTop: 10, opacity: 0.7, fontSize: 12 }}>
                  Lezárt ügy: szerkesztés tiltva.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
