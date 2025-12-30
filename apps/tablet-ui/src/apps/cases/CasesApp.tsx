import { useEffect, useMemo, useState } from "react";
import { usePlayerContext } from "../../core/session/usePlayerContext";

type CaseStatus = "Nyitott" | "Folyamatban" | "Lezárva";
type CasePriority = "Alacsony" | "Közepes" | "Magas" | "Kritikus";

type CaseEventAction =
  | "Létrehozva"
  | "Mentve"
  | "Lezárva"
  | "Újranyitva"
  | "Linkelve";

type CaseEvent = {
  id: string;
  ts: string;
  action: CaseEventAction;
  by: string;
  note?: string | null;
};

type CaseItem = {
  id: string;

  caseNumber?: string | null;
  title: string;
  summary: string;

  status: CaseStatus;
  priority: CasePriority;

  location: string;
  tags: string[];

  linkedReportIds: string[];
  linkedEvidenceIds: string[];

  createdAt: string;
  updatedAt: string;

  timeline: CaseEvent[];
};

const STORAGE_KEY = "hpx:cases:v1";
const LAST_REPORT_KEY = "hpx:evidence:lastReportId:v1";
const OPEN_EVIDENCE_KEY = "hpx:evidence:openEvidenceId:v1";
const OPEN_REPORT_KEY = "hpx:mdt:openReportId:v1";
const OPEN_CASE_KEY = "hpx:cases:openCaseId:v1";


function nowIso(): string {
  return new Date().toISOString();
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function makeEvent(ts: string, action: CaseEventAction, by: string, note?: string | null): CaseEvent {
  return { id: makeId(), ts, action, by, note: note ?? null };
}

function safeParseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function normalizeTags(raw: string): string[] {
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return Array.from(new Set(parts)).slice(0, 24);
}

function normalizeId(raw: string): string {
  return raw.trim();
}

function normalizeIdList(raw: string): string[] {
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return Array.from(new Set(parts));
}

function formatTs(ts: string): string {
  return ts && ts.length >= 19 ? ts.slice(11, 19) : ts;
}

function cloneCase(c: CaseItem): CaseItem {
  return {
    ...c,
    tags: [...c.tags],
    linkedReportIds: [...c.linkedReportIds],
    linkedEvidenceIds: [...c.linkedEvidenceIds],
    timeline: [...c.timeline],
  };
}

function computeChangeNote(prev: CaseItem, next: CaseItem): string | null {
  const changed: string[] = [];

  if ((prev.caseNumber ?? "") !== (next.caseNumber ?? "")) changed.push("Iktatószám");
  if (prev.title !== next.title) changed.push("Cím");
  if (prev.summary !== next.summary) changed.push("Leírás");
  if (prev.location !== next.location) changed.push("Helyszín");
  if (prev.status !== next.status) changed.push("Státusz");
  if (prev.priority !== next.priority) changed.push("Prioritás");

  const prevTags = prev.tags.join("|");
  const nextTags = next.tags.join("|");
  if (prevTags !== nextTags) changed.push("Tagek");

  const prevR = prev.linkedReportIds.join("|");
  const nextR = next.linkedReportIds.join("|");
  if (prevR !== nextR) changed.push("Jelentések");

  const prevE = prev.linkedEvidenceIds.join("|");
  const nextE = next.linkedEvidenceIds.join("|");
  if (prevE !== nextE) changed.push("Bizonyítékok");

  if (changed.length === 0) return null;
  return `Módosult: ${changed.join(", ")}`;
}

function loadCases(): CaseItem[] {
  const arr = safeParseJson<CaseItem[]>(localStorage.getItem(STORAGE_KEY), []);
  return (arr ?? [])
    .filter((x) => x && typeof x.id === "string")
    .map((x) => ({
      id: x.id,
      caseNumber: x.caseNumber ?? null,
      title: typeof x.title === "string" ? x.title : "Ügy",
      summary: typeof x.summary === "string" ? x.summary : "",
      status: (x.status as CaseStatus) ?? "Nyitott",
      priority: (x.priority as CasePriority) ?? "Közepes",
      location: typeof x.location === "string" ? x.location : "",
      tags: Array.isArray(x.tags) ? x.tags.filter((t) => typeof t === "string") : [],
      linkedReportIds: Array.isArray(x.linkedReportIds) ? x.linkedReportIds.filter((t) => typeof t === "string") : [],
      linkedEvidenceIds: Array.isArray(x.linkedEvidenceIds) ? x.linkedEvidenceIds.filter((t) => typeof t === "string") : [],
      createdAt: typeof x.createdAt === "string" ? x.createdAt : nowIso(),
      updatedAt: typeof x.updatedAt === "string" ? x.updatedAt : nowIso(),
      timeline: Array.isArray(x.timeline) ? (x.timeline.filter(Boolean) as CaseEvent[]) : [],
    }))
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

function persistCases(items: CaseItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // no-op
  }
}

function notify(title: string, message: string, level: "info" | "success" | "warning" | "error" = "info") {
  window.postMessage({ type: "hpx:notify", title, message, level }, "*");
}

export default function CasesApp() {
  const { data: player } = usePlayerContext();
  const actorName = player?.name ?? "—";

  const [items, setItems] = useState<CaseItem[]>(() => loadCases());

  const [search, setSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<CaseStatus | "ALL">("ALL");

  const [selectedId, setSelectedId] = useState<string | null>(() => (items[0]?.id ?? null));
  const selectedSaved = useMemo(() => items.find((x) => x.id === selectedId) ?? null, [items, selectedId]);

  const [draft, setDraft] = useState<CaseItem | null>(() => (selectedSaved ? cloneCase(selectedSaved) : null));
  const [dirty, setDirty] = useState<boolean>(false);

  const [createOpen, setCreateOpen] = useState<boolean>(false);
  const [newCaseNumber, setNewCaseNumber] = useState<string>("");
  const [newTitle, setNewTitle] = useState<string>("");
  const [newLocation, setNewLocation] = useState<string>("");
  const [newTagsRaw, setNewTagsRaw] = useState<string>("");
  const [newReportsRaw, setNewReportsRaw] = useState<string>("");
  const [newEvidenceRaw, setNewEvidenceRaw] = useState<string>("");

  const [addReportId, setAddReportId] = useState<string>("");
  const [addEvidenceId, setAddEvidenceId] = useState<string>("");

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
    setDraft(selectedSaved ? cloneCase(selectedSaved) : null);
  }, [selectedSaved, dirty]);
  useEffect(() => {
    if (dirty) return;

    try {
      const raw = localStorage.getItem(OPEN_CASE_KEY);
      if (!raw) return;

      localStorage.removeItem(OPEN_CASE_KEY);

      const id = String(JSON.parse(raw) ?? "").trim();
      if (!id) return;

      if (items.some((x) => x.id === id)) {
        setSelectedId(id);
      } else {
        // Magyar komment: ha nincs ilyen ID, akkor legalább keressen rá
        setSearch(id);
      }
    } catch {
      // no-op
    }
  }, [items, dirty]);


  useEffect(() => {
    if (selectedId && items.some((x) => x.id === selectedId)) return;
    setSelectedId(items[0]?.id ?? null);
  }, [items, selectedId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((c) => {
      if (statusFilter !== "ALL" && c.status !== statusFilter) return false;
      if (!q) return true;

      const hay = [
        c.id,
        c.caseNumber ?? "",
        c.title,
        c.summary,
        c.location,
        c.tags.join(" "),
        c.linkedReportIds.join(" "),
        c.linkedEvidenceIds.join(" "),
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(q);
    });
  }, [items, search, statusFilter]);

  function markDirty() {
    setDirty(true);
  }

  function updateDraft(patch: Partial<CaseItem>) {
    if (!draft) return;
    setDraft({ ...draft, ...patch });
    markDirty();
  }

  function createCase(): void {
    const title = (newTitle || "Új ügy").trim();
    const caseNumber = newCaseNumber.trim() || null;

    const tags = normalizeTags(newTagsRaw);
    const linkedReportIds = normalizeIdList(newReportsRaw);
    const linkedEvidenceIds = normalizeIdList(newEvidenceRaw);

    const ts = nowIso();

    const created: CaseItem = {
      id: makeId(),
      caseNumber,
      title,
      summary: "",
      status: "Nyitott",
      priority: "Közepes",
      location: newLocation.trim(),
      tags,
      linkedReportIds,
      linkedEvidenceIds,
      createdAt: ts,
      updatedAt: ts,
      timeline: [makeEvent(ts, "Létrehozva", actorName, null)],
    };

    setItems((prev) => {
      const next = [created, ...prev].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
      persistCases(next);
      return next;
    });

    setSelectedId(created.id);
    setDraft(cloneCase(created));
    setDirty(false);

    setCreateOpen(false);
    setNewCaseNumber("");
    setNewTitle("");
    setNewLocation("");
    setNewTagsRaw("");
    setNewReportsRaw("");
    setNewEvidenceRaw("");

    notify("Ügyek", "Ügy létrehozva.", "success");
  }

  function discardDraft(): void {
    if (!selectedSaved) return;
    setDraft(cloneCase(selectedSaved));
    setDirty(false);
    notify("Ügyek", "Változások elvetve.", "info");
  }

  function saveDraft(): void {
    if (!draft || !selectedSaved) return;

    const prev = selectedSaved;
    const ts = nowIso();

    const nextCase: CaseItem = {
      ...draft,
      updatedAt: ts,
      timeline: [...draft.timeline],
    };

    const note = computeChangeNote(prev, nextCase);
    if (note) {
      nextCase.timeline = [makeEvent(ts, "Mentve", actorName, note), ...nextCase.timeline].slice(0, 80);
    }

    setItems((prevList) => {
      const nextList = prevList
        .map((x) => (x.id === nextCase.id ? nextCase : x))
        .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
      persistCases(nextList);
      return nextList;
    });

    setDraft(cloneCase(nextCase));
    setDirty(false);

    notify("Ügyek", note ? "Mentve." : "Nincs változás.", note ? "success" : "info");
  }

  function toggleClosed(): void {
    if (!draft || !selectedSaved) return;

    const ts = nowIso();
    const wasClosed = selectedSaved.status === "Lezárva";
    const nextStatus: CaseStatus = wasClosed ? "Folyamatban" : "Lezárva";
    const action: CaseEventAction = wasClosed ? "Újranyitva" : "Lezárva";

    const nextCase: CaseItem = {
      ...draft,
      status: nextStatus,
      updatedAt: ts,
      timeline: [makeEvent(ts, action, actorName, null), ...draft.timeline].slice(0, 80),
    };

    setItems((prevList) => {
      const nextList = prevList
        .map((x) => (x.id === nextCase.id ? nextCase : x))
        .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
      persistCases(nextList);
      return nextList;
    });

    setDraft(cloneCase(nextCase));
    setDirty(false);

    notify("Ügyek", wasClosed ? "Ügy újranyitva." : "Ügy lezárva.", "success");
  }

  function addReportLink(reportIdRaw: string): void {
    if (!draft) return;
    const id = normalizeId(reportIdRaw);
    if (!id) return;

    if (draft.linkedReportIds.includes(id)) {
      setAddReportId("");
      return;
    }

    const ts = nowIso();
    const next: CaseItem = {
      ...draft,
      linkedReportIds: [id, ...draft.linkedReportIds].slice(0, 50),
      updatedAt: ts,
      timeline: [makeEvent(ts, "Linkelve", actorName, `Jelentés: ${id}`), ...draft.timeline].slice(0, 80),
    };

    setDraft(next);
    setDirty(true);
    setAddReportId("");
  }

  function removeReportLink(reportId: string): void {
    if (!draft) return;

    const ts = nowIso();
    const next: CaseItem = {
      ...draft,
      linkedReportIds: draft.linkedReportIds.filter((x) => x !== reportId),
      updatedAt: ts,
      timeline: [makeEvent(ts, "Linkelve", actorName, `Jelentés törölve: ${reportId}`), ...draft.timeline].slice(0, 80),
    };

    setDraft(next);
    setDirty(true);
  }

  function addEvidenceLink(evidenceIdRaw: string): void {
    if (!draft) return;
    const id = normalizeId(evidenceIdRaw);
    if (!id) return;

    if (draft.linkedEvidenceIds.includes(id)) {
      setAddEvidenceId("");
      return;
    }

    const ts = nowIso();
    const next: CaseItem = {
      ...draft,
      linkedEvidenceIds: [id, ...draft.linkedEvidenceIds].slice(0, 50),
      updatedAt: ts,
      timeline: [makeEvent(ts, "Linkelve", actorName, `Bizonyíték: ${id}`), ...draft.timeline].slice(0, 80),
    };

    setDraft(next);
    setDirty(true);
    setAddEvidenceId("");
  }

  function removeEvidenceLink(evidenceId: string): void {
    if (!draft) return;

    const ts = nowIso();
    const next: CaseItem = {
      ...draft,
      linkedEvidenceIds: draft.linkedEvidenceIds.filter((x) => x !== evidenceId),
      updatedAt: ts,
      timeline: [makeEvent(ts, "Linkelve", actorName, `Bizonyíték törölve: ${evidenceId}`), ...draft.timeline].slice(0, 80),
    };

    setDraft(next);
    setDirty(true);
  }

  function hintOpenReport(reportId: string): void {
    try {
      localStorage.setItem(OPEN_REPORT_KEY, JSON.stringify(reportId));
    } catch {}
    notify("Ügyek", "Nyisd meg az MDT-t (később deep link).", "info");
  }

  function hintOpenEvidence(evidenceId: string): void {
    try {
      localStorage.setItem(OPEN_EVIDENCE_KEY, JSON.stringify(evidenceId));
    } catch {}
    notify("Ügyek", "Nyisd meg a Bizonyítékok appot (később deep link).", "info");
  }

  const isLocked = draft?.status === "Lezárva";

  return (
    <div>
      <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 10 }}>Ügyek</div>

      <div style={{ display: "grid", gridTemplateColumns: "0.9fr 1.1fr", gap: 12 }}>
        <div style={{ border: "1px solid rgba(255,255,255,0.10)", background: "rgba(0,0,0,0.16)", padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontWeight: 900 }}>Lista</div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>Összes: {items.length} • Szűrt: {filtered.length}</div>
            </div>

            <button className="hpx-btn hpx-btnAccent" onClick={() => setCreateOpen((v) => !v)}>
              {createOpen ? "Új ügy: bezár" : "Új ügy"}
            </button>
          </div>

          {createOpen && (
            <div style={{ marginTop: 12, border: "1px solid rgba(255,216,76,0.20)", padding: 12 }}>
              <div style={{ fontWeight: 900, marginBottom: 10 }}>Új ügy létrehozása</div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <input
                  value={newCaseNumber}
                  onChange={(e) => setNewCaseNumber(e.target.value)}
                  placeholder="Iktatószám (opcionális)…"
                  style={{ width: "min(220px, 100%)", padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none" }}
                />

                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ügy címe…"
                  style={{ width: "min(320px, 100%)", padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none" }}
                />

                <input
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  placeholder="Helyszín…"
                  style={{ width: "min(260px, 100%)", padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none" }}
                />
              </div>

              <div style={{ marginTop: 10, opacity: 0.7, fontSize: 12, marginBottom: 6 }}>Tagek (vesszővel)</div>
              <input
                value={newTagsRaw}
                onChange={(e) => setNewTagsRaw(e.target.value)}
                placeholder="pl.: lopás, fegyver, kamera…"
                style={{ width: "100%", padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none" }}
              />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                <div>
                  <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 6 }}>Kapcsolt jelentések (ID-k, vesszővel)</div>
                  <input
                    value={newReportsRaw}
                    onChange={(e) => setNewReportsRaw(e.target.value)}
                    placeholder="pl.: rep_abc123, rep_def456"
                    style={{ width: "100%", padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none" }}
                  />
                  {lastReportId && (
                    <div style={{ marginTop: 6, opacity: 0.75, fontSize: 12 }}>
                      Legutóbbi jelentés: <b>{lastReportId}</b>{" "}
                      <button className="hpx-btn" onClick={() => setNewReportsRaw((v) => (v ? `${v}, ${lastReportId}` : String(lastReportId)))}>
                        + hozzáad
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 6 }}>Kapcsolt bizonyítékok (ID-k, vesszővel)</div>
                  <input
                    value={newEvidenceRaw}
                    onChange={(e) => setNewEvidenceRaw(e.target.value)}
                    placeholder="pl.: ev_001, ev_002"
                    style={{ width: "100%", padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none" }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                <button className="hpx-btn hpx-btnAccent" onClick={createCase}>Létrehozás</button>
                <button className="hpx-btn" onClick={() => setCreateOpen(false)}>Mégse</button>
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Keresés (iktató, cím, tag, ID)…"
              style={{ width: "min(380px, 100%)", padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none" }}
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as CaseStatus | "ALL")}
              style={{ padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none" }}
            >
              <option value="ALL">Minden státusz</option>
              <option value="Nyitott">Nyitott</option>
              <option value="Folyamatban">Folyamatban</option>
              <option value="Lezárva">Lezárva</option>
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
            {filtered.length === 0 ? (
              <div style={{ opacity: 0.7 }}>Nincs találat.</div>
            ) : (
              filtered.map((c) => {
                const active = c.id === selectedId;
                const border = c.status === "Lezárva" ? "rgba(47,232,110,0.20)" : "rgba(255,255,255,0.10)";
                return (
                  <div
                    key={c.id}
                    onClick={() => {
                      if (dirty) {
                        notify("Ügyek", "Van nem mentett módosítás. Előbb ments vagy elvetés.", "warning");
                        return;
                      }
                      setSelectedId(c.id);
                    }}
                    style={{
                      border: `1px solid ${border}`,
                      padding: 10,
                      cursor: "pointer",
                      background: active ? "rgba(255,216,76,0.06)" : "rgba(0,0,0,0.10)",
                      boxShadow: active ? "0 0 0 3px rgba(255,216,76,0.10)" : "none",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 900 }}>{c.caseNumber ? `${c.caseNumber} • ` : ""}{c.title}</div>
                      <div style={{ opacity: 0.7, fontSize: 12 }}>{formatTs(c.updatedAt)}</div>
                    </div>
                    <div style={{ opacity: 0.75, fontSize: 12, marginTop: 6 }}>
                      Státusz: <b>{c.status}</b> • Prioritás: <b>{c.priority}</b> • Tagek: {c.tags.join(", ") || "—"}
                    </div>
                    <div style={{ opacity: 0.75, fontSize: 12, marginTop: 4 }}>
                      Jelentések: {c.linkedReportIds.length} • Bizonyítékok: {c.linkedEvidenceIds.length}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div style={{ border: "1px solid rgba(255,255,255,0.10)", background: "rgba(0,0,0,0.16)", padding: 12 }}>
          {!draft ? (
            <div style={{ opacity: 0.7 }}>Válassz egy ügyet a listából.</div>
          ) : (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 16 }}>
                    {draft.caseNumber ? `${draft.caseNumber} • ` : ""}{draft.title || "Ügy"}
                  </div>
                  <div style={{ opacity: 0.7, fontSize: 12 }}>
                    ID: {draft.id} • {dirty ? "⚠️ Nem mentett változás" : "✅ Mentve"}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button className="hpx-btn hpx-btnAccent" onClick={saveDraft} disabled={!dirty}>Mentés</button>
                  <button className="hpx-btn" onClick={discardDraft} disabled={!dirty}>Elvetés</button>
                  <button className="hpx-btn" onClick={toggleClosed}>{draft.status === "Lezárva" ? "Újranyitás" : "Lezárás"}</button>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
                <div>
                  <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 6 }}>Iktatószám</div>
                  <input
                    value={draft.caseNumber ?? ""}
                    onChange={(e) => updateDraft({ caseNumber: e.target.value })}
                    disabled={isLocked}
                    style={{ width: "100%", padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none", opacity: isLocked ? 0.7 : 1 }}
                  />
                </div>

                <div>
                  <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 6 }}>Státusz / prioritás</div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <select
                      value={draft.status}
                      onChange={(e) => updateDraft({ status: e.target.value as CaseStatus })}
                      disabled={isLocked}
                      style={{ width: "100%", padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none", opacity: isLocked ? 0.7 : 1 }}
                    >
                      <option value="Nyitott">Nyitott</option>
                      <option value="Folyamatban">Folyamatban</option>
                      <option value="Lezárva">Lezárva</option>
                    </select>

                    <select
                      value={draft.priority}
                      onChange={(e) => updateDraft({ priority: e.target.value as CasePriority })}
                      disabled={isLocked}
                      style={{ width: "100%", padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none", opacity: isLocked ? 0.7 : 1 }}
                    >
                      <option value="Alacsony">Alacsony</option>
                      <option value="Közepes">Közepes</option>
                      <option value="Magas">Magas</option>
                      <option value="Kritikus">Kritikus</option>
                    </select>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 6 }}>Cím</div>
                <input
                  value={draft.title}
                  onChange={(e) => updateDraft({ title: e.target.value })}
                  disabled={isLocked}
                  style={{ width: "100%", padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none", opacity: isLocked ? 0.7 : 1 }}
                />
              </div>

              <div style={{ marginTop: 12 }}>
                <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 6 }}>Leírás / összefoglaló</div>
                <textarea
                  value={draft.summary}
                  onChange={(e) => updateDraft({ summary: e.target.value })}
                  disabled={isLocked}
                  placeholder="Rövid összefoglaló, státusz, teendők…"
                  style={{ width: "100%", minHeight: 90, padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none", opacity: isLocked ? 0.7 : 1 }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
                <div>
                  <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 6 }}>Helyszín</div>
                  <input
                    value={draft.location}
                    onChange={(e) => updateDraft({ location: e.target.value })}
                    disabled={isLocked}
                    style={{ width: "100%", padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none", opacity: isLocked ? 0.7 : 1 }}
                  />
                </div>

                <div>
                  <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 6 }}>Tagek (vesszővel)</div>
                  <input
                    value={draft.tags.join(", ")}
                    onChange={(e) => updateDraft({ tags: normalizeTags(e.target.value) })}
                    disabled={isLocked}
                    style={{ width: "100%", padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none", opacity: isLocked ? 0.7 : 1 }}
                  />
                </div>
              </div>

              <div style={{ marginTop: 14, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 12 }}>
                <div style={{ fontWeight: 900, marginBottom: 8 }}>Hivatkozások</div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div style={{ border: "1px solid rgba(255,255,255,0.10)", padding: 10 }}>
                    <div style={{ fontWeight: 900, marginBottom: 8 }}>Jelentések</div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <input
                        value={addReportId}
                        onChange={(e) => setAddReportId(e.target.value)}
                        placeholder="Report ID…"
                        disabled={isLocked}
                        style={{ width: "min(240px, 100%)", padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none", opacity: isLocked ? 0.7 : 1 }}
                      />
                      <button className="hpx-btn hpx-btnAccent" onClick={() => addReportLink(addReportId)} disabled={isLocked}>+ Hozzáadás</button>
                      {lastReportId && <button className="hpx-btn" onClick={() => addReportLink(String(lastReportId))} disabled={isLocked}>+ Legutóbbi</button>}
                    </div>

                    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                      {draft.linkedReportIds.length === 0 ? (
                        <div style={{ opacity: 0.7, fontSize: 12 }}>Nincs kapcsolt jelentés.</div>
                      ) : (
                        draft.linkedReportIds.map((rid) => (
                          <div key={rid} style={{ border: "1px solid rgba(255,255,255,0.10)", padding: 8 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                              <div style={{ fontWeight: 900 }}>{rid}</div>
                              <div style={{ display: "flex", gap: 8 }}>
                                <button className="hpx-btn" onClick={() => hintOpenReport(rid)}>Megnyitás</button>
                                <button className="hpx-btn" onClick={() => navigator.clipboard?.writeText(rid)}>Másolás</button>
                                <button className="hpx-btn" onClick={() => removeReportLink(rid)} disabled={isLocked}>Törlés</button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div style={{ border: "1px solid rgba(255,255,255,0.10)", padding: 10 }}>
                    <div style={{ fontWeight: 900, marginBottom: 8 }}>Bizonyítékok</div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <input
                        value={addEvidenceId}
                        onChange={(e) => setAddEvidenceId(e.target.value)}
                        placeholder="Evidence ID…"
                        disabled={isLocked}
                        style={{ width: "min(240px, 100%)", padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none", opacity: isLocked ? 0.7 : 1 }}
                      />
                      <button className="hpx-btn hpx-btnAccent" onClick={() => addEvidenceLink(addEvidenceId)} disabled={isLocked}>+ Hozzáadás</button>
                    </div>

                    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                      {draft.linkedEvidenceIds.length === 0 ? (
                        <div style={{ opacity: 0.7, fontSize: 12 }}>Nincs kapcsolt bizonyíték.</div>
                      ) : (
                        draft.linkedEvidenceIds.map((eid) => (
                          <div key={eid} style={{ border: "1px solid rgba(255,255,255,0.10)", padding: 8 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                              <div style={{ fontWeight: 900 }}>{eid}</div>
                              <div style={{ display: "flex", gap: 8 }}>
                                <button className="hpx-btn" onClick={() => hintOpenEvidence(eid)}>Megnyitás</button>
                                <button className="hpx-btn" onClick={() => navigator.clipboard?.writeText(eid)}>Másolás</button>
                                <button className="hpx-btn" onClick={() => removeEvidenceLink(eid)} disabled={isLocked}>Törlés</button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {isLocked && (
                  <div style={{ marginTop: 10, opacity: 0.7, fontSize: 12 }}>
                    Lezárt ügy: szerkesztés tiltva (betekintő marad).
                  </div>
                )}
              </div>

              <div style={{ marginTop: 14, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 12 }}>
                <div style={{ fontWeight: 900, marginBottom: 8 }}>Audit / Timeline</div>

                {draft.timeline.length === 0 ? (
                  <div style={{ opacity: 0.7, fontSize: 12 }}>—</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {draft.timeline.slice(0, 60).map((e) => (
                      <div key={e.id} style={{ border: "1px solid rgba(255,255,255,0.10)", padding: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                          <div style={{ fontWeight: 900 }}>{e.action}</div>
                          <div style={{ opacity: 0.7, fontSize: 12 }}>{formatTs(e.ts)}</div>
                        </div>
                        <div style={{ opacity: 0.75, fontSize: 12 }}>
                          {e.by} {e.note ? `• ${e.note}` : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ marginTop: 10, opacity: 0.65, fontSize: 12 }}>
                  Tipp: audit csak Mentés/Lezárás/Link műveletnél íródik (nem gépelésre).
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
