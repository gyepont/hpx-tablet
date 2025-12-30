import { useEffect, useMemo, useState } from "react";
import { usePlayerContext } from "../../core/session/usePlayerContext";
import { useLocalStorageState } from "../../core/ui/useLocalStorage";

type EvidenceStatus = "DRAFT" | "SEALED";
type EvidenceType = "Fotó" | "Videó" | "Tárgy" | "DNS" | "Ujjlenyomat" | "Egyéb";

type EvidenceEventAction = "Létrehozva" | "Megjegyzés" | "Átadva" | "Lepecsételve";

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
  title: string;
  type: EvidenceType;
  status: EvidenceStatus;

  note: string;
  tags: string[];

  reportIds: string[];
  caseIds: string[];

  holderLabel: string;

  createdAt: string;
  updatedAt: string;

  events: EvidenceEvent[];
};

const STORAGE_KEY = "hpx:evidence:v1";
const CONTEXT_KEYS = ["hpx:evidence:lastReportId:v1", "hpx:context:reportId:v1"] as const;

const ALL_TYPES: EvidenceType[] = ["Fotó", "Videó", "Tárgy", "DNS", "Ujjlenyomat", "Egyéb"];

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(prefix = "EVID"): string {
  return `${prefix}-${Math.random().toString(16).slice(2, 8)}-${Date.now().toString(16)}`;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function asString(v: unknown, fallback: string): string {
  return typeof v === "string" ? v : fallback;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean).slice(0, 50);
}


function normalizeTags(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 24);
}

function normalizeIdList(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 50);
}

function statusHu(s: EvidenceStatus): string {
  return s === "SEALED" ? "Lepecsételve" : "Szerkeszthető";
}

function canEdit(item: EvidenceItem): boolean {
  return item.status !== "SEALED";
}

function getContextLastReportId(): string | null {
  for (const k of CONTEXT_KEYS) {
    try {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const v = JSON.parse(raw) as unknown;
      if (typeof v === "string" && v.trim()) return v.trim();
    } catch {
      // no-op
    }
  }
  return null;
}

function normalizeEventAction(v: unknown): EvidenceEventAction {
  if (v === "Létrehozva" || v === "Megjegyzés" || v === "Átadva" || v === "Lepecsételve") return v;
  return "Megjegyzés";
}

function normalizeEvents(v: unknown, fallbackBy: string, fallbackHolder: string): EvidenceEvent[] {
  if (!Array.isArray(v)) {
    return [
      { id: makeId("EV"), ts: nowIso(), action: "Létrehozva", by: fallbackBy, holder: fallbackHolder, note: null },
    ];
  }

  const out: EvidenceEvent[] = [];
  for (const it of v) {
    if (!isRecord(it)) continue;
    out.push({
      id: asString(it.id, makeId("EV")),
      ts: asString(it.ts, nowIso()),
      action: normalizeEventAction(it.action),
      by: asString(it.by, fallbackBy),
      holder: typeof it.holder === "string" ? it.holder : null,
      note: typeof it.note === "string" ? it.note : null,
    });
  }

  return out.length
    ? out.slice(0, 120)
    : [{ id: makeId("EV"), ts: nowIso(), action: "Létrehozva", by: fallbackBy, holder: fallbackHolder, note: null }];
}

function normalizeType(v: unknown): EvidenceType {
  return ALL_TYPES.includes(v as EvidenceType) ? (v as EvidenceType) : "Egyéb";
}

function normalizeStatus(v: unknown): EvidenceStatus {
  return v === "SEALED" ? "SEALED" : "DRAFT";
}

function normalizeItem(v: unknown, fallbackBy: string): EvidenceItem | null {
  if (!isRecord(v)) return null;

  const id = asString(v.id, makeId("EVID"));
  const title = asString(v.title, "Új bizonyíték");
  const holderLabel = asString(v.holderLabel, fallbackBy);

  const createdAt = asString(v.createdAt, nowIso());
  const updatedAt = asString(v.updatedAt, createdAt);

  return {
    id,
    title,
    type: normalizeType(v.type),
    status: normalizeStatus(v.status),

    note: asString(v.note, ""),
    tags: asStringArray(v.tags),

    reportIds: asStringArray(v.reportIds),
    caseIds: asStringArray(v.caseIds),

    holderLabel,

    createdAt,
    updatedAt,

    events: normalizeEvents(v.events, fallbackBy, holderLabel),
  };
}

function normalizeAll(raw: unknown, fallbackBy: string): { items: EvidenceItem[]; changed: boolean } {
  if (!Array.isArray(raw)) return { items: [], changed: raw != null };

  let changed = false;
  const items: EvidenceItem[] = [];

  for (const it of raw) {
    const n = normalizeItem(it, fallbackBy);
    if (!n) {
      changed = true;
      continue;
    }
    // Magyar komment: ha régi itemben hiányzott events/tags stb, akkor ez már "változás"
    if (!isRecord(it) || !Array.isArray((it as any).events) || !Array.isArray((it as any).tags)) changed = true;
    items.push(n);
  }

  return { items, changed };
}

export default function EvidenceApp() {
  const { data: player } = usePlayerContext();

  const actorName = player?.name ?? "—";
  const actorLabel = player?.callsign ? `${player.callsign} • ${actorName}` : actorName;

  const [itemsRaw, setItemsRaw] = useLocalStorageState<any>(STORAGE_KEY, []);
  const norm = useMemo(() => normalizeAll(itemsRaw, actorLabel), [itemsRaw, actorLabel]);

  // Magyar komment: ha szemét/hiányos adat volt, automatikusan javítjuk localStorage-ban
  useEffect(() => {
    if (!norm.changed) return;
    setItemsRaw(norm.items);
  }, [norm.changed, norm.items, setItemsRaw]);

  const items = norm.items;

  const [query, setQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<EvidenceStatus | "ALL">("ALL");
  const [filterType, setFilterType] = useState<EvidenceType | "ALL">("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useMemo(() => items.find((x) => x.id === selectedId) ?? null, [items, selectedId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return items
      .filter((x) => (filterStatus === "ALL" ? true : x.status === filterStatus))
      .filter((x) => (filterType === "ALL" ? true : x.type === filterType))
      .filter((x) => {
        if (!q) return true;
        if (x.id.toLowerCase().includes(q)) return true;
        if (x.title.toLowerCase().includes(q)) return true;
        if ((x.note ?? "").toLowerCase().includes(q)) return true;
        if ((x.tags ?? []).some((t) => t.toLowerCase().includes(q))) return true;
        if ((x.reportIds ?? []).some((id) => id.toLowerCase().includes(q))) return true;
        if ((x.caseIds ?? []).some((id) => id.toLowerCase().includes(q))) return true;
        return false;
      })
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }, [items, query, filterStatus, filterType]);

  function upsert(next: EvidenceItem): void {
    setItemsRaw((prevAny: any) => {
      const prevNorm = normalizeAll(prevAny, actorLabel).items;
      const idx = prevNorm.findIndex((x) => x.id === next.id);
      if (idx === -1) return [next, ...prevNorm];
      const copy = [...prevNorm];
      copy[idx] = next;
      return copy;
    });
  }

  function pushEvent(item: EvidenceItem, action: EvidenceEventAction, payload?: { holder?: string | null; note?: string | null }): EvidenceItem {
    const ev: EvidenceEvent = {
      id: makeId("EV"),
      ts: nowIso(),
      action,
      by: actorLabel,
      holder: payload?.holder ?? null,
      note: payload?.note ?? null,
    };

    return {
      ...item,
      updatedAt: nowIso(),
      events: [ev, ...(Array.isArray(item.events) ? item.events : [])].slice(0, 120),
    };
  }

  function createNew(): void {
    const id = makeId("EVID");
    const base: EvidenceItem = {
      id,
      title: "Új bizonyíték",
      type: "Egyéb",
      status: "DRAFT",
      note: "",
      tags: [],
      reportIds: [],
      caseIds: [],
      holderLabel: actorLabel,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      events: [{ id: makeId("EV"), ts: nowIso(), action: "Létrehozva", by: actorLabel, holder: actorLabel, note: null }],
    };

    upsert(base);
    setSelectedId(id);
  }

  function updateSelected(patch: Partial<EvidenceItem>): void {
    if (!selected) return;
    if (!canEdit(selected)) return;

    upsert({ ...selected, ...patch, updatedAt: nowIso() });
  }

  function addNote(): void {
    if (!selected) return;
    if (!canEdit(selected)) return;

    const note = (prompt("Megjegyzés a bizonyítékhoz:", "") ?? "").trim();
    if (!note) return;

    upsert(pushEvent(selected, "Megjegyzés", { note }));
  }

  function transfer(): void {
    if (!selected) return;
    if (!canEdit(selected)) return;

    const holderLabel = (prompt("Kinek adod át? (pl. Raktár / A-02 / Lab)", selected.holderLabel) ?? "").trim();
    if (!holderLabel) return;

    const note = (prompt("Átadás megjegyzés (opcionális):", "") ?? "").trim() || null;

    const nextBase: EvidenceItem = { ...selected, holderLabel, updatedAt: nowIso() };
    upsert(pushEvent(nextBase, "Átadva", { holder: holderLabel, note }));
  }

  function seal(): void {
    if (!selected) return;
    if (!canEdit(selected)) return;

    const ok = confirm("Biztos lepecsételed? Utána nem szerkeszthető.");
    if (!ok) return;

    const nextBase: EvidenceItem = { ...selected, status: "SEALED", updatedAt: nowIso() };
    upsert(pushEvent(nextBase, "Lepecsételve", { holder: selected.holderLabel, note: "Lezárva" }));
  }

  function tryLinkContextReport(): void {
    if (!selected) return;
    if (!canEdit(selected)) return;

    const reportId = getContextLastReportId();
    if (!reportId) {
      alert("Nincs report kontextus beállítva még.");
      return;
    }
    if (selected.reportIds.includes(reportId)) return;

    updateSelected({ reportIds: [...selected.reportIds, reportId] });
  }

  const contextReportId = useMemo(() => getContextLastReportId(), [items.length, selectedId]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "420px 1fr", gap: 12 }}>
      <div style={{ border: "1px solid rgba(255,255,255,0.10)", background: "rgba(0,0,0,0.16)", padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 16 }}>Bizonyítékok</div>
            <div style={{ opacity: 0.7, fontSize: 12 }}>MVP • localStorage</div>
          </div>
          <button className="hpx-btn hpx-btnAccent" onClick={createNew}>Új</button>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Keresés (cím / id / tag / report id)…"
            style={{ width: "100%", padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none" }}
          />

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            style={{ padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none" }}
          >
            <option value="ALL">Minden státusz</option>
            <option value="DRAFT">Szerkeszthető</option>
            <option value="SEALED">Lepecsételve</option>
          </select>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            style={{ padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none" }}
          >
            <option value="ALL">Minden típus</option>
            {ALL_TYPES.map((t: EvidenceType) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 10 }}>
          Report kontextus: <b>{contextReportId ?? "—"}</b>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.length === 0 ? (
            <div style={{ opacity: 0.7 }}>Nincs találat.</div>
          ) : (
            filtered.map((x: EvidenceItem) => {
              const sel = x.id === selectedId;
              return (
                <div
                  key={x.id}
                  onClick={() => setSelectedId(x.id)}
                  style={{
                    border: `1px solid ${x.status === "SEALED" ? "rgba(47,232,110,0.25)" : "rgba(255,255,255,0.10)"}`,
                    padding: 10,
                    cursor: "pointer",
                    boxShadow: sel ? "0 0 0 3px rgba(255,216,76,0.10)" : "none",
                    background: "rgba(0,0,0,0.10)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ fontWeight: 900 }}>{x.title}</div>
                    <div style={{ opacity: 0.7, fontSize: 12 }}>{statusHu(x.status)}</div>
                  </div>
                  <div style={{ opacity: 0.75, fontSize: 12, marginTop: 6 }}>
                    {x.type} • Tagek: {x.tags.length ? x.tags.join(", ") : "—"}
                  </div>
                  <div style={{ opacity: 0.65, fontSize: 12, marginTop: 6 }}>
                    Report: {x.reportIds.length} • Ügy: {x.caseIds.length}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div style={{ border: "1px solid rgba(255,255,255,0.10)", background: "rgba(0,0,0,0.16)", padding: 12 }}>
        <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 10 }}>Részletek</div>

        {!selected ? (
          <div style={{ opacity: 0.7 }}>Válassz egy bizonyítékot balról.</div>
        ) : (
          <div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ opacity: 0.75, fontSize: 12 }}>ID: <b>{selected.id}</b></div>
              <div style={{ opacity: 0.75, fontSize: 12 }}>Őrző: <b>{selected.holderLabel}</b></div>
              <div style={{ opacity: 0.75, fontSize: 12 }}>Státusz: <b>{statusHu(selected.status)}</b></div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
              <button className="hpx-btn" onClick={addNote} disabled={!canEdit(selected)}>Megjegyzés</button>
              <button className="hpx-btn" onClick={transfer} disabled={!canEdit(selected)}>Átadás</button>
              <button className="hpx-btn hpx-btnAccent" onClick={seal} disabled={!canEdit(selected)}>Lepecsételés</button>
              <button className="hpx-btn" onClick={tryLinkContextReport} disabled={!canEdit(selected)}>Link a kontextus reporthoz</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 220px", gap: 12, marginTop: 12 }}>
              <div>
                <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 6 }}>Cím</div>
                <input
                  value={selected.title}
                  onChange={(e) => updateSelected({ title: e.target.value })}
                  disabled={!canEdit(selected)}
                  style={{ width: "100%", padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none" }}
                />
              </div>

              <div>
                <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 6 }}>Típus</div>
                <select
                  value={selected.type}
                  onChange={(e) => updateSelected({ type: e.target.value as EvidenceType })}
                  disabled={!canEdit(selected)}
                  style={{ width: "100%", padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none" }}
                >
                  {ALL_TYPES.map((t: EvidenceType) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 6 }}>Leírás / jegyzet</div>
              <textarea
                value={selected.note}
                onChange={(e) => updateSelected({ note: e.target.value })}
                disabled={!canEdit(selected)}
                style={{ width: "100%", minHeight: 90, padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none" }}
              />
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 6 }}>Tagek (vesszővel)</div>
              <input
                value={selected.tags.join(", ")}
                onChange={(e) => updateSelected({ tags: normalizeTags(e.target.value) })}
                disabled={!canEdit(selected)}
                style={{ width: "100%", padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none" }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
              <div>
                <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 6 }}>Kapcsolt jelentés ID-k (vesszővel)</div>
                <input
                  value={selected.reportIds.join(", ")}
                  onChange={(e) => updateSelected({ reportIds: normalizeIdList(e.target.value) })}
                  disabled={!canEdit(selected)}
                  style={{ width: "100%", padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none" }}
                />
              </div>

              <div>
                <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 6 }}>Kapcsolt ügy ID-k (vesszővel)</div>
                <input
                  value={selected.caseIds.join(", ")}
                  onChange={(e) => updateSelected({ caseIds: normalizeIdList(e.target.value) })}
                  disabled={!canEdit(selected)}
                  style={{ width: "100%", padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none" }}
                />
              </div>
            </div>

            <div style={{ fontWeight: 900, marginTop: 12, marginBottom: 6 }}>Chain-of-custody</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(Array.isArray(selected.events) ? selected.events : []).map((e: EvidenceEvent) => (
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

            {selected.status === "SEALED" && (
              <div style={{ marginTop: 10, opacity: 0.7, fontSize: 12 }}>
                Lepecsételve: szerkesztés tiltva.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
