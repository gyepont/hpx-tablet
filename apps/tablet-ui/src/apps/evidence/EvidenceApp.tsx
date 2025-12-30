import { useEffect, useMemo, useState } from "react";
import { useLocalStorageState } from "../../core/ui/useLocalStorage";

type EvidenceStatus = "OPEN" | "SEALED";

type EvidenceEventAction =
  | "Létrehozva"
  | "Megjegyzés"
  | "Átadva"
  | "Lepecsételve"
  | "Iktatva";

type EvidenceEvent = {
  id: string;
  ts: string;
  action: EvidenceEventAction;
  by: string;
  holder?: string | null;
  note?: string | null;
};

type EvidenceType = "Fotó" | "Videó" | "Ujjlenyomat" | "DNS" | "Fegyver" | "Ruházat" | "Egyéb";

type EvidenceItem = {
  id: string;
  type: EvidenceType;
  title: string;

  status: EvidenceStatus;

  note: string;
  tags: string[];

  linkedReportId?: string | null;
  caseId?: string | null;

  holderLabel: string;

  createdAt: string;
  updatedAt: string;

  events: EvidenceEvent[];
};

type CaseLite = {
  id: string;
  title: string;
  status?: string;
  evidenceIds?: string[];
  timeline?: Array<{ id: string; ts: string; action: string; by: string; note?: string | null }>;
  updatedAt?: string;
};

const EVIDENCE_KEY = "hpx:evidence:v1";
const LAST_REPORT_KEY = "hpx:evidence:lastReportId:v1";
const ACTIVE_CASE_KEY = "hpx:cases:activeCaseId:v1";
const LAST_OPEN_CASE_KEY = "hpx:cases:lastCaseId:v1";
const CASES_KEY = "hpx:cases:v1";

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix = "EVD") {
  const rnd = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}-${Date.now()}-${rnd}`;
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

function getLastReportId(): string | null {
  return safeParse<string | null>(localStorage.getItem(LAST_REPORT_KEY), null);
}

function getActiveCaseId(): string | null {
  return safeParse<string | null>(localStorage.getItem(ACTIVE_CASE_KEY), null);
}

function loadCases(): CaseLite[] {
  return safeParse<CaseLite[]>(localStorage.getItem(CASES_KEY), []);
}

function saveCases(next: CaseLite[]) {
  try {
    localStorage.setItem(CASES_KEY, JSON.stringify(next));
  } catch {
    // no-op
  }
}

function addCaseEvidenceLink(caseId: string, evidenceId: string) {
  const cases = loadCases();
  const idx = cases.findIndex((c) => c.id === caseId);
  if (idx === -1) return;

  const c = cases[idx];
  const evidenceIds = Array.isArray(c.evidenceIds) ? c.evidenceIds.slice() : [];
  if (!evidenceIds.includes(evidenceId)) evidenceIds.unshift(evidenceId);

  const timeline = Array.isArray(c.timeline) ? c.timeline.slice() : [];
  timeline.unshift({
    id: `${Date.now()}-${Math.random()}`,
    ts: nowIso(),
    action: "Bizonyíték iktatva",
    by: "UI",
    note: evidenceId,
  });

  const updated: CaseLite = {
    ...c,
    evidenceIds: evidenceIds.slice(0, 200),
    timeline: timeline.slice(0, 80),
    updatedAt: nowIso(),
  };

  const next = cases.slice();
  next[idx] = updated;
  saveCases(next);
}

function openCaseFromEvidence(caseId: string) {
  try {
    localStorage.setItem(ACTIVE_CASE_KEY, JSON.stringify(caseId));
    localStorage.setItem(LAST_OPEN_CASE_KEY, JSON.stringify(caseId));
  } catch {
    // no-op
  }
}

export default function EvidenceApp() {
  const [items, setItems] = useLocalStorageState<EvidenceItem[]>(EVIDENCE_KEY, []);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [casesVersion, setCasesVersion] = useState(0);
  const cases = useMemo(() => loadCases(), [casesVersion]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<EvidenceStatus | "ALL">("ALL");
  const [typeFilter, setTypeFilter] = useState<EvidenceType | "ALL">("ALL");

  const lastReportId = useMemo(() => getLastReportId(), [items.length]);
  const activeCaseId = useMemo(() => getActiveCaseId(), [casesVersion, items.length]);

  const selected = useMemo(() => items.find((x) => x.id === selectedId) ?? null, [items, selectedId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter((x) => (statusFilter === "ALL" ? true : x.status === statusFilter))
      .filter((x) => (typeFilter === "ALL" ? true : x.type === typeFilter))
      .filter((x) => {
        if (!q) return true;
        return (
          x.id.toLowerCase().includes(q) ||
          x.title.toLowerCase().includes(q) ||
          x.tags.join(",").toLowerCase().includes(q) ||
          String(x.linkedReportId ?? "").toLowerCase().includes(q) ||
          String(x.caseId ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }, [items, search, statusFilter, typeFilter]);

  function selectEvidence(id: string) {
    setSelectedId(id);
  }

  function updateEvidence(id: string, patch: Partial<EvidenceItem>, event?: { action: EvidenceEventAction; note?: string | null; holder?: string | null }) {
    setItems((prev) => {
      const next = prev.map((x) => {
        if (x.id !== id) return x;

        const evs = event
          ? [
              {
                id: `${Date.now()}-${Math.random()}`,
                ts: nowIso(),
                action: event.action,
                by: "UI",
                holder: event.holder ?? null,
                note: event.note ?? null,
              },
              ...x.events,
            ].slice(0, 120)
          : x.events;

        const updated: EvidenceItem = {
          ...x,
          ...patch,
          updatedAt: nowIso(),
          events: evs,
        };

        return updated;
      });
      return next;
    });
  }

  function createEvidence() {
    const id = makeId("EVD");
    const createdAt = nowIso();

    const initCase = activeCaseId ?? null;
    const initReport = lastReportId ?? null;

    const item: EvidenceItem = {
      id,
      type: "Egyéb",
      title: "Új bizonyíték",
      status: "OPEN",
      note: "",
      tags: [],
      linkedReportId: initReport,
      caseId: initCase,
      holderLabel: "Bizonyítékraktár",
      createdAt,
      updatedAt: createdAt,
      events: [{ id: `${Date.now()}-${Math.random()}`, ts: createdAt, action: "Létrehozva", by: "UI", holder: "Bizonyítékraktár", note: null }],
    };

    setItems((prev) => [item, ...prev]);
    setSelectedId(id);

    if (initCase) {
      addCaseEvidenceLink(initCase, id);
      toast("Bizonyítékok", `Létrehozva + iktatva: ${initCase}`, "success");
      setCasesVersion((v) => v + 1);
    } else {
      toast("Bizonyítékok", "Bizonyíték létrehozva.", "success");
    }
  }

  function refreshCases() {
    setCasesVersion((v) => v + 1);
    toast("Ügyek", "Ügy lista frissítve.", "info");
  }

  function linkToCase(caseId: string) {
    if (!selected) return;
    if (!caseId) return;

    updateEvidence(selected.id, { caseId }, { action: "Iktatva", note: caseId, holder: selected.holderLabel });
    addCaseEvidenceLink(caseId, selected.id);
    setCasesVersion((v) => v + 1);

    toast("Bizonyítékok", `Iktatva az ügybe: ${caseId}`, "success");
  }

  function linkToActiveCase() {
    const cid = getActiveCaseId();
    if (!cid) {
      toast("Bizonyítékok", "Nincs aktív ügy. Nyisd meg az Ügyek appot és válassz egy ügyet.", "warning");
      return;
    }
    linkToCase(cid);
  }

  function openCase() {
    if (!selected?.caseId) {
      toast("Bizonyítékok", "Nincs ügy hozzárendelve ehhez a bizonyítékhoz.", "warning");
      return;
    }
    openCaseFromEvidence(selected.caseId);
    toast("Ügyek", `Ügy előkészítve: ${selected.caseId} (nyisd meg az Ügyek appot)`, "info");
  }

  const locked = selected?.status === "SEALED";

  function transferEvidence() {
    if (!selected) return;
    if (locked) return;

    const holder = (prompt("Új őrző/átvevő:", selected.holderLabel) ?? "").trim();
    if (!holder) return;

    const note = (prompt("Megjegyzés (opcionális):", "") ?? "").trim();
    updateEvidence(selected.id, { holderLabel: holder }, { action: "Átadva", holder, note: note || null });
    toast("Bizonyítékok", "Átadás rögzítve.", "success");
  }

  function addNote() {
    if (!selected) return;
    const note = (prompt("Megjegyzés:", "") ?? "").trim();
    if (!note) return;
    updateEvidence(selected.id, { note: selected.note ? `${selected.note}\n${note}` : note }, { action: "Megjegyzés", note, holder: selected.holderLabel });
    toast("Bizonyítékok", "Megjegyzés hozzáadva.", "success");
  }

  function sealEvidence() {
    if (!selected) return;
    if (selected.status === "SEALED") return;
    updateEvidence(selected.id, { status: "SEALED" }, { action: "Lepecsételve", note: null, holder: selected.holderLabel });
    toast("Bizonyítékok", "Lepecsételve (szerkesztés tiltva).", "success");
  }

  useEffect(() => {
    if (!selectedId && items.length) setSelectedId(items[0].id);
  }, [items.length, selectedId]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 16 }}>Bizonyítékok</div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>
            Utolsó megnyitott jelentés: <b>{lastReportId ?? "—"}</b> • Aktív ügy: <b>{activeCaseId ?? "—"}</b>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="hpx-btn" onClick={refreshCases}>Ügyek frissítése</button>
          <button className="hpx-btn hpx-btnAccent" onClick={createEvidence}>Új bizonyíték</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "420px 1fr", gap: 12, marginTop: 12 }}>
        <div style={{ border: "1px solid rgba(255,255,255,0.10)", background: "rgba(0,0,0,0.16)", padding: 12 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Keresés (ID/cím/tag/report/ügy)…"
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
              <option value="OPEN">Nyitott</option>
              <option value="SEALED">Lezárt</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              style={{
                padding: "10px 10px",
                borderRadius: 0,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(0,0,0,0.18)",
                color: "rgba(255,255,255,0.92)",
                outline: "none",
              }}
            >
              <option value="ALL">Minden típus</option>
              <option value="Fotó">Fotó</option>
              <option value="Videó">Videó</option>
              <option value="Ujjlenyomat">Ujjlenyomat</option>
              <option value="DNS">DNS</option>
              <option value="Fegyver">Fegyver</option>
              <option value="Ruházat">Ruházat</option>
              <option value="Egyéb">Egyéb</option>
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
            {filtered.length === 0 ? (
              <div style={{ opacity: 0.7 }}>Nincs bizonyíték.</div>
            ) : (
              filtered.map((x) => (
                <div
                  key={x.id}
                  onClick={() => selectEvidence(x.id)}
                  style={{
                    border: "1px solid rgba(255,255,255,0.10)",
                    padding: 10,
                    cursor: "pointer",
                    boxShadow: selectedId === x.id ? "0 0 0 3px rgba(255,216,76,0.10)" : "none",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 900 }}>{x.title}</div>
                    <div style={{ opacity: 0.75, fontSize: 12 }}>{x.status === "SEALED" ? "LEZÁRT" : "NYITOTT"}</div>
                  </div>
                  <div style={{ opacity: 0.75, fontSize: 12, marginTop: 6 }}>
                    <b>{x.id}</b> • {x.type}
                  </div>
                  <div style={{ opacity: 0.65, fontSize: 12, marginTop: 6 }}>
                    Ügy: {x.caseId ?? "—"} • Jelentés: {x.linkedReportId ?? "—"}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div style={{ border: "1px solid rgba(255,255,255,0.10)", background: "rgba(0,0,0,0.16)", padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ fontWeight: 900, fontSize: 16 }}>Részletek</div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="hpx-btn" onClick={addNote} disabled={!selected || locked}>Megjegyzés</button>
              <button className="hpx-btn" onClick={transferEvidence} disabled={!selected || locked}>Átadás</button>
              <button className="hpx-btn hpx-btnAccent" onClick={sealEvidence} disabled={!selected || locked}>Lepecsételés</button>
            </div>
          </div>

          {!selected ? (
            <div style={{ opacity: 0.75, marginTop: 12 }}>Válassz egy bizonyítékot bal oldalt.</div>
          ) : (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <select
                  value={selected.type}
                  onChange={(e) => updateEvidence(selected.id, { type: e.target.value as EvidenceType }, { action: "Megjegyzés", note: "Típus módosítva", holder: selected.holderLabel })}
                  disabled={locked}
                  style={{
                    padding: "10px 10px",
                    borderRadius: 0,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(0,0,0,0.18)",
                    color: "rgba(255,255,255,0.92)",
                    outline: "none",
                  }}
                >
                  <option value="Fotó">Fotó</option>
                  <option value="Videó">Videó</option>
                  <option value="Ujjlenyomat">Ujjlenyomat</option>
                  <option value="DNS">DNS</option>
                  <option value="Fegyver">Fegyver</option>
                  <option value="Ruházat">Ruházat</option>
                  <option value="Egyéb">Egyéb</option>
                </select>

                <input
                  value={selected.title}
                  onChange={(e) => updateEvidence(selected.id, { title: e.target.value }, { action: "Megjegyzés", note: "Cím módosítva", holder: selected.holderLabel })}
                  disabled={locked}
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
              </div>

              <div style={{ marginTop: 10 }}>
                <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 6 }}>Jegyzet</div>
                <textarea
                  value={selected.note}
                  onChange={(e) => updateEvidence(selected.id, { note: e.target.value }, undefined)}
                  disabled={locked}
                  style={{
                    width: "100%",
                    minHeight: 90,
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
                  onChange={(e) => updateEvidence(selected.id, { tags: normalizeTags(e.target.value) }, undefined)}
                  disabled={locked}
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
                  <div style={{ fontWeight: 900, marginBottom: 8 }}>Kapcsolatok</div>
                  <div style={{ opacity: 0.75, fontSize: 12 }}>
                    Jelentés ID: <b>{selected.linkedReportId ?? "—"}</b>
                  </div>
                  <div style={{ opacity: 0.75, fontSize: 12, marginTop: 6 }}>
                    Ügy ID: <b>{selected.caseId ?? "—"}</b>
                  </div>

                  <div style={{ marginTop: 10, opacity: 0.7, fontSize: 12 }}>Iktatás ügyhöz</div>
                  <select
                    value={selected.caseId ?? ""}
                    onChange={(e) => linkToCase(e.target.value)}
                    disabled={locked}
                    style={{
                      width: "100%",
                      padding: "10px 10px",
                      borderRadius: 0,
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: "rgba(0,0,0,0.18)",
                      color: "rgba(255,255,255,0.92)",
                      outline: "none",
                      marginTop: 6,
                    }}
                  >
                    <option value="">— nincs —</option>
                    {cases.slice(0, 200).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.id} • {c.title}
                      </option>
                    ))}
                  </select>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
                    <button className="hpx-btn hpx-btnAccent" onClick={linkToActiveCase} disabled={!selected || locked}>
                      Iktatás az aktív ügyhöz
                    </button>
                    <button className="hpx-btn" onClick={openCase} disabled={!selected || !selected.caseId}>
                      Ügy nyitása ebből
                    </button>
                  </div>

                  <div style={{ marginTop: 10, opacity: 0.65, fontSize: 12 }}>
                    Tipp: “Ügy nyitása ebből” után nyisd meg az Ügyek appot, automatikusan erre az ügyre ugrik.
                  </div>
                </div>

                <div style={{ border: "1px solid rgba(255,255,255,0.10)", padding: 10 }}>
                  <div style={{ fontWeight: 900, marginBottom: 8 }}>Chain-of-custody</div>
                  <div style={{ opacity: 0.75, fontSize: 12 }}>
                    Aktuális őrző: <b>{selected.holderLabel}</b>
                  </div>
                  <div style={{ opacity: 0.7, fontSize: 12, marginTop: 10 }}>
                    Lepecsételés után a bizonyíték nem szerkeszthető.
                  </div>
                </div>
              </div>

              <div style={{ fontWeight: 900, marginTop: 14, marginBottom: 6 }}>Timeline / Audit</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {selected.events.slice(0, 80).map((e) => (
                  <div key={e.id} style={{ border: "1px solid rgba(255,255,255,0.10)", padding: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ fontWeight: 900 }}>{e.action}</div>
                      <div style={{ opacity: 0.7, fontSize: 12 }}>{e.ts}</div>
                    </div>
                    <div style={{ opacity: 0.75, fontSize: 12 }}>
                      {e.by} {e.holder ? `• ${e.holder}` : ""} {e.note ? `• ${e.note}` : ""}
                    </div>
                  </div>
                ))}
              </div>

              {locked && (
                <div style={{ marginTop: 10, opacity: 0.7, fontSize: 12 }}>
                  Lezárva: szerkesztés tiltva.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
