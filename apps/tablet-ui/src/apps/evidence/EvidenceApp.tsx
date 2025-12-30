import { useEffect, useMemo, useState } from "react";
import { useLocalStorageState } from "../../core/ui/useLocalStorage";

type EvidenceStatus = "OPEN" | "SEALED";
type EvidenceType = "Tárgy" | "Fotó" | "Videó" | "DNS" | "Ujjlenyomat" | "Egyéb";

type EvidenceEventAction = "Létrehozva" | "Frissítve" | "Megjegyzés" | "Átadva" | "Lepecsételve";

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
  type: EvidenceType;
  status: EvidenceStatus;

  title: string;
  note: string;

  tags: string[];
  reportIds: string[];

  holderLabel: string;

  createdAt: string;
  updatedAt: string;

  events: EvidenceEvent[];
};

const EVIDENCE_KEY = "hpx:evidence:v1";
const LAST_REPORT_KEY = "hpx:evidence:lastReportId:v1";

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix = "EV") {
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

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function normalizeTagsInput(s: string): string[] {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 24);
}

function normalizeIdsInput(s: string): string[] {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 64);
}

function normalizeStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x)).map((x) => x.trim()).filter(Boolean).slice(0, 200);
}

function normalizeType(v: unknown): EvidenceType {
  const s = String(v ?? "");
  if (s === "Tárgy" || s === "Fotó" || s === "Videó" || s === "DNS" || s === "Ujjlenyomat" || s === "Egyéb") return s;
  return "Egyéb";
}

function normalizeStatus(v: unknown): EvidenceStatus {
  return v === "SEALED" ? "SEALED" : "OPEN";
}

function normalizeEvents(v: unknown, createdAt: string): EvidenceEvent[] {
  if (!Array.isArray(v) || v.length === 0) {
    return [{ id: `${Date.now()}-${Math.random()}`, ts: createdAt, action: "Létrehozva", by: "UI", holder: "Raktár", note: null }];
  }

  const out: EvidenceEvent[] = [];
  for (const it of v) {
    const o = it as any;
    const actionRaw = String(o?.action ?? "");
    const action: EvidenceEventAction =
      actionRaw === "Frissítve" ||
      actionRaw === "Megjegyzés" ||
      actionRaw === "Átadva" ||
      actionRaw === "Lepecsételve"
        ? (actionRaw as EvidenceEventAction)
        : "Létrehozva";

    out.push({
      id: String(o?.id ?? `${Date.now()}-${Math.random()}`),
      ts: String(o?.ts ?? createdAt),
      action,
      by: String(o?.by ?? "UI"),
      holder: o?.holder == null ? null : String(o.holder),
      note: o?.note == null ? null : String(o.note),
    });
  }
  return out.slice(0, 120);
}

function normalizeEvidence(raw: unknown): EvidenceItem {
  const o = raw as any;

  const id = String(o?.id ?? makeId("EV"));
  const createdAt = String(o?.createdAt ?? nowIso());
  const updatedAt = String(o?.updatedAt ?? createdAt);

  const type = normalizeType(o?.type);
  const status = normalizeStatus(o?.status);

  const title = String(o?.title ?? "Bizonyíték");
  const note = String(o?.note ?? "");

  const tags = Array.isArray(o?.tags) ? o.tags.map((x: any) => String(x)).filter(Boolean).slice(0, 24) : [];
  const reportIds = normalizeStringArray(o?.reportIds);

  const holderLabel = String(o?.holderLabel ?? "Raktár");

  const events = normalizeEvents(o?.events, createdAt);

  return {
    id,
    type,
    status,
    title,
    note,
    tags,
    reportIds,
    holderLabel,
    createdAt,
    updatedAt,
    events,
  };
}

/** Magyar komment: régi localStorage formátumok kimentése (pl. { items: [...] }) */
function extractEvidenceList(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    const o = raw as any;
    if (Array.isArray(o.items)) return o.items;
    if (Array.isArray(o.evidences)) return o.evidences;
    if (Array.isArray(o.data)) return o.data;
  }
  return [];
}

function joinChangeList(changes: string[]): string | null {
  if (changes.length === 0) return null;
  return `Változott: ${changes.join(", ")}`;
}

export default function EvidenceApp() {
  const [itemsRaw, setItemsRaw] = useLocalStorageState<unknown>(EVIDENCE_KEY, []);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Magyar komment: ha nem tömb a storage, migráljuk tömbbé (különben runtime crash)
  useEffect(() => {
    if (Array.isArray(itemsRaw)) return;
    const list = extractEvidenceList(itemsRaw);
    setItemsRaw(list);
  }, [itemsRaw, setItemsRaw]);

  const items = useMemo(() => extractEvidenceList(itemsRaw).map((x) => normalizeEvidence(x)), [itemsRaw]);

  const setItems = (updater: (prev: EvidenceItem[]) => EvidenceItem[]) => {
    setItemsRaw((prevRaw: any) => {
      const prev = extractEvidenceList(prevRaw).map((x) => normalizeEvidence(x));
      const next = updater(prev);
      return next;
    });
  };

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<EvidenceStatus | "ALL">("ALL");
  const [typeFilter, setTypeFilter] = useState<EvidenceType | "ALL">("ALL");

  const selected = useMemo(() => items.find((x) => x.id === activeId) ?? null, [items, activeId]);
  const isLocked = selected?.status === "SEALED";

  // ===== Draft mezők (csak Mentés ír timeline-t) =====
  const [draftTitle, setDraftTitle] = useState("");
  const [draftNote, setDraftNote] = useState("");
  const [draftTagsText, setDraftTagsText] = useState("");
  const [draftReportIdsText, setDraftReportIdsText] = useState("");
  const [draftType, setDraftType] = useState<EvidenceType>("Egyéb");

  useEffect(() => {
    if (!selected) {
      setDraftTitle("");
      setDraftNote("");
      setDraftTagsText("");
      setDraftReportIdsText("");
      setDraftType("Egyéb");
      return;
    }

    setDraftTitle(selected.title ?? "");
    setDraftNote(selected.note ?? "");
    setDraftTagsText((selected.tags ?? []).join(", "));
    setDraftReportIdsText((selected.reportIds ?? []).join(", "));
    setDraftType(selected.type ?? "Egyéb");
  }, [selected?.id]);

  const draftTags = useMemo(() => normalizeTagsInput(draftTagsText), [draftTagsText]);
  const draftReportIds = useMemo(() => normalizeIdsInput(draftReportIdsText), [draftReportIdsText]);

  const isDirty = useMemo(() => {
    if (!selected) return false;
    if (draftTitle !== (selected.title ?? "")) return true;
    if (draftNote !== (selected.note ?? "")) return true;
    if (draftType !== (selected.type ?? "Egyéb")) return true;
    if (JSON.stringify(draftTags) !== JSON.stringify(selected.tags ?? [])) return true;
    if (JSON.stringify(draftReportIds) !== JSON.stringify(selected.reportIds ?? [])) return true;
    return false;
  }, [selected, draftTitle, draftNote, draftType, draftTags, draftReportIds]);

  const lastReportId = useMemo(() => {
    try {
      const raw = localStorage.getItem(LAST_REPORT_KEY);
      const v = safeParse<string | null>(raw, null);
      return v ? String(v) : null;
    } catch {
      return null;
    }
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((x) => (statusFilter === "ALL" ? true : x.status === statusFilter))
      .filter((x) => (typeFilter === "ALL" ? true : x.type === typeFilter))
      .filter((x) => {
        if (!q) return true;
        return (
          x.id.toLowerCase().includes(q) ||
          x.title.toLowerCase().includes(q) ||
          x.tags.join(",").toLowerCase().includes(q) ||
          x.reportIds.join(",").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }, [items, query, statusFilter, typeFilter]);

  useEffect(() => {
    if (!activeId && items.length) setActiveId(items[0].id);
    if (activeId && !items.some((x) => x.id === activeId)) setActiveId(items.length ? items[0].id : null);
  }, [items, activeId]);

  function updateEvidence(
    id: string,
    patch: Partial<EvidenceItem>,
    event?: { action: EvidenceEventAction; note?: string | null; holder?: string | null }
  ) {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;

        const base = normalizeEvidence(it);
        const newEvents = event
          ? [
              {
                id: `${Date.now()}-${Math.random()}`,
                ts: nowIso(),
                action: event.action,
                by: "UI",
                holder: event.holder ?? base.holderLabel ?? null,
                note: event.note ?? null,
              },
              ...(base.events ?? []),
            ].slice(0, 120)
          : (base.events ?? []);

        return {
          ...base,
          ...patch,
          updatedAt: nowIso(),
          events: newEvents,
        };
      })
    );
  }

  function createNew() {
    const id = makeId("EV");
    const createdAt = nowIso();

    const item: EvidenceItem = {
      id,
      type: "Egyéb",
      status: "OPEN",
      title: "Bizonyíték",
      note: "",
      tags: [],
      reportIds: [],
      holderLabel: "Raktár",
      createdAt,
      updatedAt: createdAt,
      events: [{ id: `${Date.now()}-${Math.random()}`, ts: createdAt, action: "Létrehozva", by: "UI", holder: "Raktár", note: null }],
    };

    setItems((prev) => [item, ...prev]);
    setActiveId(id);
    toast("Bizonyítékok", `Létrehozva: ${id}`, "success");
  }

  function saveNow() {
    if (!selected) return;
    if (isLocked) return;

    const changes: string[] = [];
    if (draftTitle !== (selected.title ?? "")) changes.push("cím");
    if (draftNote !== (selected.note ?? "")) changes.push("jegyzet");
    if (draftType !== (selected.type ?? "Egyéb")) changes.push("típus");
    if (JSON.stringify(draftTags) !== JSON.stringify(selected.tags ?? [])) changes.push("tagek");
    if (JSON.stringify(draftReportIds) !== JSON.stringify(selected.reportIds ?? [])) changes.push("report linkek");

    updateEvidence(
      selected.id,
      { title: draftTitle, note: draftNote, type: draftType, tags: draftTags, reportIds: draftReportIds },
      { action: "Frissítve", note: joinChangeList(changes), holder: selected.holderLabel }
    );

    toast("Bizonyítékok", "Mentve.", "success");
  }

  function addQuickLinkToLastReport() {
    if (!lastReportId) return;
    const list = normalizeIdsInput(draftReportIdsText);
    if (list.includes(lastReportId)) return;
    setDraftReportIdsText([lastReportId, ...list].join(", "));
  }

  function addNoteEvent() {
    if (!selected) return;
    const txt = (prompt("Megjegyzés:", "") ?? "").trim();
    if (!txt) return;
    updateEvidence(selected.id, {}, { action: "Megjegyzés", note: txt, holder: selected.holderLabel });
    toast("Bizonyítékok", "Megjegyzés rögzítve.", "success");
  }

  function transfer() {
    if (!selected) return;
    if (selected.status === "SEALED") return;

    const holder = (prompt("Kinek adod át? (pl. Labor / Nyomozó / Raktár)", selected.holderLabel) ?? "").trim();
    if (!holder) return;

    const note = (prompt("Átadás megjegyzés (opcionális):", "") ?? "").trim();

    updateEvidence(selected.id, { holderLabel: holder }, { action: "Átadva", note: note || null, holder });
    toast("Bizonyítékok", `Átadva: ${holder}`, "success");
  }

  function seal() {
    if (!selected) return;
    if (selected.status === "SEALED") return;

    if (isDirty) saveNow();
    updateEvidence(selected.id, { status: "SEALED" }, { action: "Lepecsételve", note: null, holder: selected.holderLabel });
    toast("Bizonyítékok", "Lepecsételve (read-only).", "success");
  }

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 16 }}>Bizonyítékok</div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>
            Utolsó megnyitott jelentés: <b>{lastReportId ?? "—"}</b>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="hpx-btn hpx-btnAccent" onClick={createNew}>Új bizonyíték</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "420px 1fr", gap: 12, marginTop: 12 }}>
        <div style={{ border: "1px solid rgba(255,255,255,0.10)", background: "rgba(0,0,0,0.16)", padding: 12 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Keresés (ID/cím/tag/report)…"
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
              <option value="SEALED">Lepecsételt</option>
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
              <option value="Tárgy">Tárgy</option>
              <option value="Fotó">Fotó</option>
              <option value="Videó">Videó</option>
              <option value="DNS">DNS</option>
              <option value="Ujjlenyomat">Ujjlenyomat</option>
              <option value="Egyéb">Egyéb</option>
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
            {filtered.length === 0 ? (
              <div style={{ opacity: 0.7 }}>Nincs bizonyíték.</div>
            ) : (
              filtered.map((e) => (
                <div
                  key={e.id}
                  onClick={() => setActiveId(e.id)}
                  style={{
                    border: "1px solid rgba(255,255,255,0.10)",
                    padding: 10,
                    cursor: "pointer",
                    boxShadow: e.id === activeId ? "0 0 0 3px rgba(255,216,76,0.10)" : "none",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 900 }}>{e.title}</div>
                    <div style={{ opacity: 0.75, fontSize: 12 }}>{e.status}</div>
                  </div>
                  <div style={{ opacity: 0.75, fontSize: 12, marginTop: 6 }}>
                    <b>{e.id}</b> • {e.type} • {e.holderLabel}
                  </div>
                  <div style={{ opacity: 0.65, fontSize: 12, marginTop: 6 }}>
                    Report link: {e.reportIds.length} • Tagek: {e.tags.length}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div style={{ border: "1px solid rgba(255,255,255,0.10)", background: "rgba(0,0,0,0.16)", padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 900, fontSize: 16 }}>Részletek</div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>Kijelölt: <b>{selected?.id ?? "—"}</b></div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              {selected && !isLocked && (
                <div style={{ opacity: 0.75, fontSize: 12 }}>
                  {isDirty ? "Van nem mentett módosítás." : "Minden mentve."}
                </div>
              )}

              <button className="hpx-btn" onClick={saveNow} disabled={!selected || isLocked || !isDirty}>Mentés</button>
              <button className="hpx-btn" onClick={addNoteEvent} disabled={!selected}>Megjegyzés</button>
              <button className="hpx-btn" onClick={transfer} disabled={!selected || isLocked}>Átadás</button>
              <button className="hpx-btn hpx-btnAccent" onClick={seal} disabled={!selected || isLocked}>Lepecsétel</button>
            </div>
          </div>

          {!selected ? (
            <div style={{ opacity: 0.75, marginTop: 12 }}>Válassz egy bizonyítékot bal oldalt.</div>
          ) : (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <select
                  value={draftType}
                  onChange={(e) => setDraftType(e.target.value as EvidenceType)}
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
                  <option value="Tárgy">Tárgy</option>
                  <option value="Fotó">Fotó</option>
                  <option value="Videó">Videó</option>
                  <option value="DNS">DNS</option>
                  <option value="Ujjlenyomat">Ujjlenyomat</option>
                  <option value="Egyéb">Egyéb</option>
                </select>

                <input
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
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
              </div>

              <div style={{ marginTop: 10 }}>
                <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 6 }}>Jegyzet</div>
                <textarea
                  value={draftNote}
                  onChange={(e) => setDraftNote(e.target.value)}
                  disabled={isLocked}
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
                  value={draftTagsText}
                  onChange={(e) => setDraftTagsText(e.target.value)}
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
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ opacity: 0.7, fontSize: 12 }}>Kapcsolt jelentések (ID-k, vesszővel)</div>
                  <button className="hpx-btn" onClick={addQuickLinkToLastReport} disabled={!lastReportId || isLocked}>
                    + Utolsó jelentés
                  </button>
                </div>

                <input
                  value={draftReportIdsText}
                  onChange={(e) => setDraftReportIdsText(e.target.value)}
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

              <div style={{ marginTop: 14 }}>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>Chain-of-custody / Timeline</div>
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

                {isLocked && (
                  <div style={{ marginTop: 10, opacity: 0.7, fontSize: 12 }}>
                    Lepecsételt bizonyíték: szerkesztés tiltva.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 10, opacity: 0.65, fontSize: 12 }}>
        Tipp: az MDT-ben egy jelentés megnyitása beállítja az “Utolsó megnyitott jelentés” kontextust itt.
      </div>
    </div>
  );
}
