import { useEffect, useMemo, useState } from "react";
import { usePlayerContext } from "../../core/session/usePlayerContext";

type EvidenceStatus = "NYITOTT" | "SEALED";

type EvidenceType =
  | "Tárgy"
  | "Fegyver"
  | "DNS"
  | "Ujjlenyomat"
  | "Fotó"
  | "Videó"
  | "Egyéb";

type EvidenceEventAction =
  | "Létrehozva"
  | "Mentve"
  | "Átadva"
  | "Lepecsételve"
  | "Ügy linkelve";

type EvidenceEvent = {
  id: string;
  ts: string;
  action: EvidenceEventAction;
  by: string;
  holder?: string | null;
  note?: string | null;
};

type EvidenceItem = {
  id: string;
  label: string;
  type: EvidenceType;
  status: EvidenceStatus;

  holder: string; // aktuális birtokos (chain-of-custody)
  note: string;
  tags: string[];

  reportId?: string | null;
  caseId?: string | null;

  createdAt: string;
  updatedAt: string;

  events: EvidenceEvent[];
};

type CaseLite = {
  id: string;
  caseNumber?: string | null;
  title?: string | null;
  linkedEvidenceIds?: string[];
  timeline?: Array<{ id: string; ts: string; action: "Létrehozva" | "Mentve" | "Lezárva" | "Újranyitva" | "Linkelve"; by: string; note?: string | null }>;
  updatedAt?: string;
};

const EVIDENCE_KEY = "hpx:evidence:v1";
const CASES_KEY = "hpx:cases:v1";
const LAST_REPORT_KEY = "hpx:evidence:lastReportId:v1";
const OPEN_CASE_KEY = "hpx:cases:openCaseId:v1";

const OPEN_EVIDENCE_KEY = "hpx:evidence:openEvidenceId:v1";

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function notify(title: string, message: string, level: "info" | "success" | "warning" | "error" = "info") {
  window.postMessage({ type: "hpx:notify", title, message, level }, "*");
}

function safeParseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function persistEvidence(items: EvidenceItem[]): void {
  try {
    localStorage.setItem(EVIDENCE_KEY, JSON.stringify(items));
  } catch {
    // no-op
  }
}

function loadEvidence(): EvidenceItem[] {
  const arr = safeParseJson<EvidenceItem[]>(localStorage.getItem(EVIDENCE_KEY), []);
  return (arr ?? [])
    .filter((x) => x && typeof x.id === "string")
    .map((x) => ({
      id: x.id,
      label: typeof x.label === "string" ? x.label : "Bizonyíték",
      type: (x.type as EvidenceType) ?? "Egyéb",
      status: (x.status as EvidenceStatus) ?? "NYITOTT",
      holder: typeof x.holder === "string" ? x.holder : "—",
      note: typeof x.note === "string" ? x.note : "",
      tags: Array.isArray(x.tags) ? x.tags.filter((t) => typeof t === "string") : [],
      reportId: x.reportId ?? null,
      caseId: x.caseId ?? null,
      createdAt: typeof x.createdAt === "string" ? x.createdAt : nowIso(),
      updatedAt: typeof x.updatedAt === "string" ? x.updatedAt : nowIso(),
      events: Array.isArray(x.events) ? (x.events.filter(Boolean) as EvidenceEvent[]) : [],
    }))
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

function loadCasesLite(): CaseLite[] {
  const arr = safeParseJson<CaseLite[]>(localStorage.getItem(CASES_KEY), []);
  return (arr ?? []).filter((x) => x && typeof x.id === "string");
}

function normalizeTags(raw: string): string[] {
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return Array.from(new Set(parts)).slice(0, 24);
}

function formatTs(ts: string): string {
  return ts && ts.length >= 19 ? ts.slice(11, 19) : ts;
}

function makeEvent(action: EvidenceEventAction, by: string, holder?: string | null, note?: string | null): EvidenceEvent {
  return { id: makeId(), ts: nowIso(), action, by, holder: holder ?? null, note: note ?? null };
}

function cloneEvidence(e: EvidenceItem): EvidenceItem {
  return { ...e, tags: [...e.tags], events: [...e.events] };
}

export default function EvidenceApp() {
  const { data: player } = usePlayerContext();
  const actorName = player?.name ?? "—";

  const [items, setItems] = useState<EvidenceItem[]>(() => loadEvidence());
  const [casesLite, setCasesLite] = useState<CaseLite[]>(() => loadCasesLite());

  const [search, setSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<EvidenceStatus | "ALL">("ALL");
  const [typeFilter, setTypeFilter] = useState<EvidenceType | "ALL">("ALL");

  const [selectedId, setSelectedId] = useState<string | null>(() => items[0]?.id ?? null);
  const selectedSaved = useMemo(() => items.find((x) => x.id === selectedId) ?? null, [items, selectedId]);

  const [draft, setDraft] = useState<EvidenceItem | null>(() => (selectedSaved ? cloneEvidence(selectedSaved) : null));
  const [dirty, setDirty] = useState<boolean>(false);

  const [createOpen, setCreateOpen] = useState<boolean>(false);
  const [newLabel, setNewLabel] = useState<string>("");
  const [newType, setNewType] = useState<EvidenceType>("Egyéb");
  const [newHolder, setNewHolder] = useState<string>("Bizonyíték raktár");
  const [newTagsRaw, setNewTagsRaw] = useState<string>("");
  const [newReportId, setNewReportId] = useState<string>("");
  const [newCaseId, setNewCaseId] = useState<string>("");

  const lastReportId = useMemo(() => {
    try {
      const raw = localStorage.getItem(LAST_REPORT_KEY);
      return raw ? String(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (dirty) return;
    setDraft(selectedSaved ? cloneEvidence(selectedSaved) : null);
  }, [selectedSaved, dirty]);

  useEffect(() => {
    if (selectedId && items.some((x) => x.id === selectedId)) return;
    setSelectedId(items[0]?.id ?? null);
  }, [items, selectedId]);

  useEffect(() => {
    // Magyar komment: Evidence deep-link (későbbi “Ügyből megnyitás” előkészítés)
    try {
      const raw = localStorage.getItem(OPEN_EVIDENCE_KEY);
      if (!raw) return;
      localStorage.removeItem(OPEN_EVIDENCE_KEY);
      const id = String(JSON.parse(raw) ?? "");
      if (!id) return;
      if (items.some((x) => x.id === id)) setSelectedId(id);
      else setSearch(id);
    } catch {
      // no-op
    }
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((e) => {
      if (statusFilter !== "ALL" && e.status !== statusFilter) return false;
      if (typeFilter !== "ALL" && e.type !== typeFilter) return false;

      if (!q) return true;

      const hay = [
        e.id,
        e.label,
        e.type,
        e.status,
        e.holder,
        e.note,
        e.tags.join(" "),
        e.reportId ?? "",
        e.caseId ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(q);
    });
  }, [items, search, statusFilter, typeFilter]);

  const caseMap = useMemo(() => {
    const m = new Map<string, CaseLite>();
    for (const c of casesLite) m.set(c.id, c);
    return m;
  }, [casesLite]);

  function refreshCasesLite(): void {
    setCasesLite(loadCasesLite());
    notify("Bizonyítékok", "Ügy lista frissítve.", "info");
  }

  function markDirty(): void {
    setDirty(true);
  }

  function updateDraft(patch: Partial<EvidenceItem>): void {
    if (!draft) return;
    setDraft({ ...draft, ...patch });
    markDirty();
  }

  function discardDraft(): void {
    if (!selectedSaved) return;
    setDraft(cloneEvidence(selectedSaved));
    setDirty(false);
    notify("Bizonyítékok", "Változások elvetve.", "info");
  }

  function saveDraft(): void {
    if (!draft || !selectedSaved) return;

    const ts = nowIso();
    const next: EvidenceItem = {
      ...draft,
      updatedAt: ts,
      events: [...draft.events],
    };

    // Magyar komment: csak mentésnél írunk audit sort (nem gépelésnél!)
    next.events = [makeEvent("Mentve", actorName, next.holder, "Módosítások mentve"), ...next.events].slice(0, 80);

    setItems((prev) => {
      const updated = prev
        .map((x) => (x.id === next.id ? next : x))
        .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
      persistEvidence(updated);
      return updated;
    });

    setDraft(cloneEvidence(next));
    setDirty(false);
    notify("Bizonyítékok", "Mentve.", "success");
  }

  function sealEvidence(): void {
    if (!draft || !selectedSaved) return;
    if (draft.status === "SEALED") return;

    const ts = nowIso();
    const next: EvidenceItem = {
      ...draft,
      status: "SEALED",
      updatedAt: ts,
      events: [makeEvent("Lepecsételve", actorName, draft.holder, null), ...draft.events].slice(0, 80),
    };

    setItems((prev) => {
      const updated = prev
        .map((x) => (x.id === next.id ? next : x))
        .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
      persistEvidence(updated);
      return updated;
    });

    setDraft(cloneEvidence(next));
    setDirty(false);
    notify("Bizonyítékok", "Bizonyíték lepecsételve (read-only).", "success");
  }

  function transferEvidence(): void {
    if (!draft || !selectedSaved) return;
    if (draft.status === "SEALED") {
      notify("Bizonyítékok", "Lepecsételt bizonyíték nem adható át.", "warning");
      return;
    }

    const newHolder = (prompt("Új birtokos (osztály/személy):", draft.holder) ?? "").trim();
    if (!newHolder) return;

    const note = (prompt("Megjegyzés (opcionális):", "") ?? "").trim();
    const ts = nowIso();

    const next: EvidenceItem = {
      ...draft,
      holder: newHolder,
      updatedAt: ts,
      events: [makeEvent("Átadva", actorName, newHolder, note || null), ...draft.events].slice(0, 80),
    };

    setItems((prev) => {
      const updated = prev
        .map((x) => (x.id === next.id ? next : x))
        .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
      persistEvidence(updated);
      return updated;
    });

    setDraft(cloneEvidence(next));
    setDirty(false);
    notify("Bizonyítékok", `Átadva: ${newHolder}`, "success");
  }

  function linkToCase(caseId: string): void {
    if (!draft || !selectedSaved) return;
    if (!caseId) return;

    const ts = nowIso();
    const next: EvidenceItem = {
      ...draft,
      caseId,
      updatedAt: ts,
      events: [makeEvent("Ügy linkelve", actorName, draft.holder, `Ügy: ${caseId}`), ...draft.events].slice(0, 80),
    };

    // Magyar komment: Evidence mentése
    setItems((prev) => {
      const updated = prev
        .map((x) => (x.id === next.id ? next : x))
        .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
      persistEvidence(updated);
      return updated;
    });

    // Magyar komment: Case automatikus frissítése (linkedEvidenceIds + timeline)
    try {
      const cases = safeParseJson<CaseLite[]>(localStorage.getItem(CASES_KEY), []);
      const updatedCases = (cases ?? []).map((c) => {
        if (c.id !== caseId) return c;

        const current = Array.isArray(c.linkedEvidenceIds) ? c.linkedEvidenceIds : [];
        const nextLinks = current.includes(next.id) ? current : [next.id, ...current].slice(0, 50);

        const tl = Array.isArray(c.timeline) ? c.timeline : [];
        const nextTl = [
          { id: makeId(), ts, action: "Linkelve" as const, by: actorName, note: `Bizonyíték: ${next.id}` },
          ...tl,
        ].slice(0, 80);

        return { ...c, linkedEvidenceIds: nextLinks, timeline: nextTl, updatedAt: ts };
      });

      localStorage.setItem(CASES_KEY, JSON.stringify(updatedCases));
    } catch {
      // no-op
    }

    setDraft(cloneEvidence(next));
    setDirty(false);

    notify("Bizonyítékok", "Ügyhöz linkelve + az Ügyben is rögzítve.", "success");
  }

  function openCaseFromEvidence(): void {
    if (!draft?.caseId) return;
    try {
      localStorage.setItem(OPEN_CASE_KEY, JSON.stringify(draft.caseId));
    } catch {}
    notify("Bizonyítékok", "Nyisd meg az Ügyek appot (automatikusan kiválasztja).", "info");
  }

  function createEvidence(): void {
    const label = (newLabel || "Új bizonyíték").trim();
    const holder = (newHolder || "Bizonyíték raktár").trim() || "—";
    const tags = normalizeTags(newTagsRaw);

    const ts = nowIso();

    const created: EvidenceItem = {
      id: makeId(),
      label,
      type: newType,
      status: "NYITOTT",
      holder,
      note: "",
      tags,
      reportId: (newReportId || "").trim() || null,
      caseId: (newCaseId || "").trim() || null,
      createdAt: ts,
      updatedAt: ts,
      events: [makeEvent("Létrehozva", actorName, holder, null)],
    };

    setItems((prev) => {
      const next = [created, ...prev].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
      persistEvidence(next);
      return next;
    });

    setSelectedId(created.id);
    setDraft(cloneEvidence(created));
    setDirty(false);

    setCreateOpen(false);
    setNewLabel("");
    setNewType("Egyéb");
    setNewHolder("Bizonyíték raktár");
    setNewTagsRaw("");
    setNewReportId("");
    setNewCaseId("");

    notify("Bizonyítékok", "Bizonyíték létrehozva.", "success");
  }

  const locked = draft?.status === "SEALED";

  function caseLabel(caseId: string | null | undefined): string {
    if (!caseId) return "—";
    const c = caseMap.get(caseId);
    if (!c) return caseId;
    const n = (c.caseNumber ?? "").trim();
    const t = (c.title ?? "").trim();
    return `${n ? n + " • " : ""}${t || "Ügy"} (${c.id})`;
  }

  function safeSelect(id: string): void {
    if (dirty) {
      notify("Bizonyítékok", "Van nem mentett módosítás. Előbb Mentés / Elvetés.", "warning");
      return;
    }
    setSelectedId(id);
  }

  return (
    <div>
      <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 10 }}>Bizonyítékok</div>

      <div style={{ display: "grid", gridTemplateColumns: "0.9fr 1.1fr", gap: 12 }}>
        <div style={{ border: "1px solid rgba(255,255,255,0.10)", background: "rgba(0,0,0,0.16)", padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontWeight: 900 }}>Lista</div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>Összes: {items.length} • Szűrt: {filtered.length}</div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="hpx-btn" onClick={refreshCasesLite}>Ügy lista frissítés</button>
              <button className="hpx-btn hpx-btnAccent" onClick={() => setCreateOpen((v) => !v)}>
                {createOpen ? "Új: bezár" : "Új bizonyíték"}
              </button>
            </div>
          </div>

          {createOpen && (
            <div style={{ marginTop: 12, border: "1px solid rgba(255,216,76,0.20)", padding: 12 }}>
              <div style={{ fontWeight: 900, marginBottom: 10 }}>Új bizonyíték</div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <input
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="Megnevezés…"
                  style={{ width: "min(320px, 100%)", padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none" }}
                />

                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as EvidenceType)}
                  style={{ padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none" }}
                >
                  {(["Tárgy","Fegyver","DNS","Ujjlenyomat","Fotó","Videó","Egyéb"] as EvidenceType[]).map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>

                <input
                  value={newHolder}
                  onChange={(e) => setNewHolder(e.target.value)}
                  placeholder="Birtokos…"
                  style={{ width: "min(260px, 100%)", padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none" }}
                />
              </div>

              <div style={{ marginTop: 10, opacity: 0.7, fontSize: 12, marginBottom: 6 }}>Tagek (vesszővel)</div>
              <input
                value={newTagsRaw}
                onChange={(e) => setNewTagsRaw(e.target.value)}
                placeholder="pl.: kamera, vágásnyom, lőszer…"
                style={{ width: "100%", padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none" }}
              />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                <div>
                  <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 6 }}>Kapcsolt jelentés (Report ID)</div>
                  <input
                    value={newReportId}
                    onChange={(e) => setNewReportId(e.target.value)}
                    placeholder="pl.: rep_xxx"
                    style={{ width: "100%", padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none" }}
                  />
                  {lastReportId && (
                    <div style={{ marginTop: 6, opacity: 0.75, fontSize: 12 }}>
                      Legutóbbi jelentés: <b>{lastReportId}</b>{" "}
                      <button className="hpx-btn" onClick={() => setNewReportId(String(lastReportId))}>
                        Kitölt
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 6 }}>Ügy hozzárendelés (opcionális)</div>
                  <select
                    value={newCaseId}
                    onChange={(e) => setNewCaseId(e.target.value)}
                    style={{ width: "100%", padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none" }}
                  >
                    <option value="">— (nincs)</option>
                    {casesLite.slice(0, 200).map((c) => (
                      <option key={c.id} value={c.id}>
                        {(c.caseNumber ? `${c.caseNumber} • ` : "") + (c.title ?? "Ügy") + ` (${c.id})`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                <button className="hpx-btn hpx-btnAccent" onClick={createEvidence}>Létrehozás</button>
                <button className="hpx-btn" onClick={() => setCreateOpen(false)}>Mégse</button>
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Keresés…"
              style={{ width: "min(320px, 100%)", padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none" }}
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as EvidenceStatus | "ALL")}
              style={{ padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none" }}
            >
              <option value="ALL">Minden státusz</option>
              <option value="NYITOTT">NYITOTT</option>
              <option value="SEALED">SEALED</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as EvidenceType | "ALL")}
              style={{ padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none" }}
            >
              <option value="ALL">Minden típus</option>
              {(["Tárgy","Fegyver","DNS","Ujjlenyomat","Fotó","Videó","Egyéb"] as EvidenceType[]).map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
            {filtered.length === 0 ? (
              <div style={{ opacity: 0.7 }}>Nincs találat.</div>
            ) : (
              filtered.map((e) => (
                <div
                  key={e.id}
                  onClick={() => safeSelect(e.id)}
                  style={{
                    border: `1px solid ${e.status === "SEALED" ? "rgba(47,232,110,0.20)" : "rgba(255,255,255,0.10)"}`,
                    padding: 10,
                    cursor: "pointer",
                    background: e.id === selectedId ? "rgba(255,216,76,0.06)" : "rgba(0,0,0,0.10)",
                    boxShadow: e.id === selectedId ? "0 0 0 3px rgba(255,216,76,0.10)" : "none",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 900 }}>{e.label}</div>
                    <div style={{ opacity: 0.7, fontSize: 12 }}>{formatTs(e.updatedAt)}</div>
                  </div>
                  <div style={{ opacity: 0.75, fontSize: 12, marginTop: 6 }}>
                    {e.type} • {e.status} • Birtokos: <b>{e.holder}</b>
                  </div>
                  <div style={{ opacity: 0.7, fontSize: 12, marginTop: 4 }}>
                    Ügy: {e.caseId ? "✅" : "—"} • Jelentés: {e.reportId ? "✅" : "—"} • Tagek: {e.tags.join(", ") || "—"}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div style={{ border: "1px solid rgba(255,255,255,0.10)", background: "rgba(0,0,0,0.16)", padding: 12 }}>
          {!draft ? (
            <div style={{ opacity: 0.7 }}>Válassz egy bizonyítékot.</div>
          ) : (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 16 }}>{draft.label}</div>
                  <div style={{ opacity: 0.7, fontSize: 12 }}>
                    ID: {draft.id} • {dirty ? "⚠️ Nem mentett változás" : "✅ Mentve"} • {draft.status}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button className="hpx-btn hpx-btnAccent" onClick={saveDraft} disabled={!dirty || locked}>Mentés</button>
                  <button className="hpx-btn" onClick={discardDraft} disabled={!dirty}>Elvetés</button>
                  <button className="hpx-btn" onClick={transferEvidence} disabled={locked}>Átadás</button>
                  <button className="hpx-btn" onClick={sealEvidence} disabled={locked}>Lepecsételés</button>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
                <div>
                  <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 6 }}>Típus</div>
                  <select
                    value={draft.type}
                    onChange={(e) => updateDraft({ type: e.target.value as EvidenceType })}
                    disabled={locked}
                    style={{ width: "100%", padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none", opacity: locked ? 0.7 : 1 }}
                  >
                    {(["Tárgy","Fegyver","DNS","Ujjlenyomat","Fotó","Videó","Egyéb"] as EvidenceType[]).map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 6 }}>Birtokos</div>
                  <input
                    value={draft.holder}
                    onChange={(e) => updateDraft({ holder: e.target.value })}
                    disabled={locked}
                    style={{ width: "100%", padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none", opacity: locked ? 0.7 : 1 }}
                  />
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 6 }}>Megnevezés</div>
                <input
                  value={draft.label}
                  onChange={(e) => updateDraft({ label: e.target.value })}
                  disabled={locked}
                  style={{ width: "100%", padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none", opacity: locked ? 0.7 : 1 }}
                />
              </div>

              <div style={{ marginTop: 12 }}>
                <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 6 }}>Jegyzet</div>
                <textarea
                  value={draft.note}
                  onChange={(e) => updateDraft({ note: e.target.value })}
                  disabled={locked}
                  placeholder="Rövid jegyzet…"
                  style={{ width: "100%", minHeight: 90, padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none", opacity: locked ? 0.7 : 1 }}
                />
              </div>

              <div style={{ marginTop: 12 }}>
                <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 6 }}>Tagek (vesszővel)</div>
                <input
                  value={draft.tags.join(", ")}
                  onChange={(e) => updateDraft({ tags: normalizeTags(e.target.value) })}
                  disabled={locked}
                  style={{ width: "100%", padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none", opacity: locked ? 0.7 : 1 }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
                <div>
                  <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 6 }}>Kapcsolt jelentés (Report ID)</div>
                  <input
                    value={draft.reportId ?? ""}
                    onChange={(e) => updateDraft({ reportId: e.target.value })}
                    disabled={locked}
                    style={{ width: "100%", padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none", opacity: locked ? 0.7 : 1 }}
                  />
                </div>

                <div>
                  <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 6 }}>Ügy hozzárendelés</div>
                  <select
                    value={draft.caseId ?? ""}
                    onChange={(e) => updateDraft({ caseId: e.target.value || null })}
                    disabled={locked}
                    style={{ width: "100%", padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none", opacity: locked ? 0.7 : 1 }}
                  >
                    <option value="">— (nincs)</option>
                    {casesLite.slice(0, 200).map((c) => (
                      <option key={c.id} value={c.id}>
                        {(c.caseNumber ? `${c.caseNumber} • ` : "") + (c.title ?? "Ügy") + ` (${c.id})`}
                      </option>
                    ))}
                  </select>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
                    <button
                      className="hpx-btn hpx-btnAccent"
                      onClick={() => draft.caseId ? linkToCase(draft.caseId) : notify("Bizonyítékok", "Válassz ügyet.", "warning")}
                      disabled={locked || !draft.caseId}
                      style={{ opacity: locked ? 0.7 : 1 }}
                    >
                      Link ügyhöz
                    </button>

                    <button className="hpx-btn" onClick={openCaseFromEvidence} disabled={!draft.caseId}>
                      Ügy nyitása ebből
                    </button>

                    <div style={{ opacity: 0.75, fontSize: 12, alignSelf: "center" }}>
                      {draft.caseId ? caseLabel(draft.caseId) : "—"}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ fontWeight: 900, marginTop: 14, marginBottom: 6 }}>Chain-of-custody / Timeline</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {draft.events.slice(0, 60).map((e) => (
                  <div key={e.id} style={{ border: "1px solid rgba(255,255,255,0.10)", padding: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 900 }}>{e.action}</div>
                      <div style={{ opacity: 0.7, fontSize: 12 }}>{formatTs(e.ts)}</div>
                    </div>
                    <div style={{ opacity: 0.75, fontSize: 12 }}>
                      {e.by} {e.holder ? `• ${e.holder}` : ""} {e.note ? `• ${e.note}` : ""}
                    </div>
                  </div>
                ))}
              </div>

              {locked && (
                <div style={{ marginTop: 10, opacity: 0.7, fontSize: 12 }}>
                  Lepecsételt bizonyíték: szerkesztés tiltva (betekintő marad).
                </div>
              )}

              <div style={{ marginTop: 10, opacity: 0.65, fontSize: 12 }}>
                Tipp: audit csak Mentés / Átadás / Lepecsételés / Ügy link műveletnél íródik (nem gépelésre).
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
