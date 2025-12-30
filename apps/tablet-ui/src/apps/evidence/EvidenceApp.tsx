import { useEffect, useMemo, useState } from "react";

type EvidenceStatus = "OPEN" | "SEALED";

type EvidenceAction = "Létrehozva" | "Megjegyzés" | "Átadva" | "Lepecsételve";

type EvidenceEvent = {
  id: string;
  ts: string;
  action: EvidenceAction;
  by: string;
  holder?: string | null;
  note?: string | null;
};

type EvidenceType =
  | "Fotó"
  | "Videó"
  | "DNS"
  | "Ujjlenyomat"
  | "Fegyver"
  | "Tárgy"
  | "Egyéb";

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

const STORE_KEY = "hpx:evidence:v1";
const LAST_REPORT_KEY = "hpx:evidence:lastReportId:v1";

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(prefix = "EV"): string {
  return `${prefix}-${Math.random().toString(16).slice(2, 10)}-${Date.now().toString(16)}`;
}

function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function normalizeTags(input: string): string[] {
  return input
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 30);
}

function normalizeReportIds(input: string): string[] {
  return input
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 30);
}

function getLastReportId(): string | null {
  const v = safeJsonParse<unknown>(localStorage.getItem(LAST_REPORT_KEY));
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

function loadEvidence(): EvidenceItem[] {
  const items = safeJsonParse<EvidenceItem[]>(localStorage.getItem(STORE_KEY));
  return Array.isArray(items) ? items : [];
}

function saveEvidence(items: EvidenceItem[]): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(items));
  } catch {
    // no-op
  }
}

function statusLabel(s: EvidenceStatus): string {
  return s === "OPEN" ? "Nyitott" : "Lepecsételve";
}

export default function EvidenceApp() {
  const [items, setItems] = useState<EvidenceItem[]>(() => loadEvidence());

  const [query, setQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"ALL" | EvidenceStatus>("ALL");
  const [filterType, setFilterType] = useState<"ALL" | EvidenceType>("ALL");

  const [contextReportId, setContextReportId] = useState<string>(() => getLastReportId() ?? "");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(() => items.find((x) => x.id === selectedId) ?? null, [items, selectedId]);

  // Új bizonyíték (MVP)
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<EvidenceType>("Tárgy");
  const [newNote, setNewNote] = useState("");
  const [newTags, setNewTags] = useState("");

  // Szerkesztés mezők
  const [editTags, setEditTags] = useState("");
  const [editReportIds, setEditReportIds] = useState("");
  const [transferHolder, setTransferHolder] = useState("");
  const [transferNote, setTransferNote] = useState("");

  useEffect(() => {
    saveEvidence(items);
  }, [items]);

  useEffect(() => {
    if (!selected) return;
    setEditTags(selected.tags.join(", "));
    setEditReportIds(selected.reportIds.join(", "));
    setTransferHolder("");
    setTransferNote("");
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase();

    return items.filter((it) => {
      if (filterStatus !== "ALL" && it.status !== filterStatus) return false;
      if (filterType !== "ALL" && it.type !== filterType) return false;

      if (!q) return true;

      const hay = [
        it.id,
        it.title,
        it.type,
        it.note,
        it.holderLabel,
        it.tags.join(" "),
        it.reportIds.join(" "),
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(q);
    });
  }, [items, query, filterStatus, filterType]);

  function updateItem(id: string, patch: Partial<EvidenceItem>) {
    setItems((prev) =>
      prev.map((x) => (x.id === id ? { ...x, ...patch, updatedAt: nowIso() } : x))
    );
  }

  function pushEvent(id: string, ev: EvidenceEvent) {
    setItems((prev) =>
      prev.map((x) => (x.id === id ? { ...x, events: [ev, ...x.events], updatedAt: nowIso() } : x))
    );
  }

  function refreshContextFromMdt() {
    const last = getLastReportId();
    if (last) setContextReportId(last);
  }

  function createEvidence() {
    const title = newTitle.trim();
    if (!title) return;

    const reportIds = contextReportId.trim() ? [contextReportId.trim()] : [];

    const id = makeId("EV");
    const ts = nowIso();

    const item: EvidenceItem = {
      id,
      type: newType,
      status: "OPEN",
      title,
      note: newNote.trim(),
      tags: normalizeTags(newTags),
      reportIds,
      holderLabel: "Rendőrség",
      createdAt: ts,
      updatedAt: ts,
      events: [
        {
          id: makeId("EVE"),
          ts,
          action: "Létrehozva",
          by: "Rendszer",
          holder: "Rendőrség",
          note: reportIds.length ? `Kapcsolt jelentés: ${reportIds[0]}` : null,
        },
      ],
    };

    setItems((prev) => [item, ...prev].slice(0, 500));
    setSelectedId(id);

    setNewTitle("");
    setNewNote("");
    setNewTags("");
  }

  function applyLinks() {
    if (!selected) return;
    if (selected.status === "SEALED") return;

    updateItem(selected.id, {
      tags: normalizeTags(editTags),
      reportIds: normalizeReportIds(editReportIds),
    });

    pushEvent(selected.id, {
      id: makeId("EVE"),
      ts: nowIso(),
      action: "Megjegyzés",
      by: "Szerkesztés",
      note: "Tagek/jelentés linkek frissítve.",
    });
  }

  function addNoteEvent() {
    if (!selected) return;
    if (selected.status === "SEALED") return;

    const note = prompt("Megjegyzés:", "")?.trim() ?? "";
    if (!note) return;

    pushEvent(selected.id, {
      id: makeId("EVE"),
      ts: nowIso(),
      action: "Megjegyzés",
      by: "Felhasználó",
      note,
    });
  }

  function transferEvidence() {
    if (!selected) return;
    if (selected.status === "SEALED") return;

    const holder = transferHolder.trim();
    if (!holder) return;

    updateItem(selected.id, { holderLabel: holder });

    pushEvent(selected.id, {
      id: makeId("EVE"),
      ts: nowIso(),
      action: "Átadva",
      by: "Felhasználó",
      holder,
      note: transferNote.trim() || null,
    });

    setTransferHolder("");
    setTransferNote("");
  }

  function sealEvidence() {
    if (!selected) return;
    if (selected.status === "SEALED") return;

    updateItem(selected.id, { status: "SEALED" });

    pushEvent(selected.id, {
      id: makeId("EVE"),
      ts: nowIso(),
      action: "Lepecsételve",
      by: "Felhasználó",
      holder: selected.holderLabel,
      note: "Lezárva: szerkesztés tiltva.",
    });
  }

  const typeOptions: EvidenceType[] = ["Fotó", "Videó", "DNS", "Ujjlenyomat", "Fegyver", "Tárgy", "Egyéb"];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "420px 1fr", gap: 12 }}>
      <div style={{ border: "1px solid rgba(255,255,255,0.10)", background: "rgba(0,0,0,0.16)", padding: 12 }}>
        <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 10 }}>Bizonyítékok</div>

        <div style={{ border: "1px solid rgba(255,216,76,0.20)", padding: 10, marginBottom: 10 }}>
          <div style={{ fontWeight: 900, marginBottom: 6 }}>Kapcsolt jelentés (MDT)</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              value={contextReportId}
              onChange={(e) => setContextReportId(e.target.value)}
              placeholder="Report ID…"
              style={{
                width: "min(260px, 100%)",
                padding: "10px 10px",
                borderRadius: 0,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(0,0,0,0.18)",
                color: "rgba(255,255,255,0.92)",
                outline: "none",
              }}
            />
            <button className="hpx-btn" onClick={refreshContextFromMdt}>
              Frissítés MDT-ből
            </button>
          </div>
          <div style={{ marginTop: 6, opacity: 0.7, fontSize: 12 }}>
            Új bizonyíték létrehozásakor automatikusan hozzáadjuk a report ID-t.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Keresés…"
            style={{
              width: "min(220px, 100%)",
              padding: "10px 10px",
              borderRadius: 0,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(0,0,0,0.18)",
              color: "rgba(255,255,255,0.92)",
              outline: "none",
            }}
          />

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            style={{
              padding: "10px 10px",
              borderRadius: 0,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(0,0,0,0.18)",
              color: "rgba(255,255,255,0.92)",
              outline: "none",
            }}
          >
            <option value="ALL">Minden státusz</option>
            <option value="OPEN">Nyitott</option>
            <option value="SEALED">Lepecsételve</option>
          </select>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
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
            {typeOptions.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div style={{ border: "1px solid rgba(255,255,255,0.10)", padding: 10, marginBottom: 10 }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Új bizonyíték</div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as EvidenceType)}
              style={{
                padding: "10px 10px",
                borderRadius: 0,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(0,0,0,0.18)",
                color: "rgba(255,255,255,0.92)",
                outline: "none",
              }}
            >
              {typeOptions.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>

            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Cím…"
              style={{
                width: "min(260px, 100%)",
                padding: "10px 10px",
                borderRadius: 0,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(0,0,0,0.18)",
                color: "rgba(255,255,255,0.92)",
                outline: "none",
              }}
            />
          </div>

          <textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Rövid megjegyzés…"
            style={{
              width: "100%",
              minHeight: 72,
              padding: "10px 10px",
              borderRadius: 0,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(0,0,0,0.18)",
              color: "rgba(255,255,255,0.92)",
              outline: "none",
            }}
          />

          <div style={{ marginTop: 10 }}>
            <input
              value={newTags}
              onChange={(e) => setNewTags(e.target.value)}
              placeholder="Tagek (vesszővel)…"
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
            <button className="hpx-btn hpx-btnAccent" onClick={createEvidence} disabled={!newTitle.trim()}>
              Létrehozás
            </button>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {visibleItems.length === 0 ? (
            <div style={{ opacity: 0.7 }}>Nincs találat.</div>
          ) : (
            visibleItems.slice(0, 120).map((it) => (
              <div
                key={it.id}
                onClick={() => setSelectedId(it.id)}
                style={{
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: selectedId === it.id ? "rgba(255,216,76,0.08)" : "transparent",
                  padding: 10,
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 900 }}>{it.title}</div>
                  <div style={{ opacity: 0.7, fontSize: 12 }}>{it.id}</div>
                </div>
                <div style={{ opacity: 0.78, fontSize: 12, marginTop: 6 }}>
                  {it.type} • {statusLabel(it.status)} • Holder: {it.holderLabel}
                </div>
                <div style={{ opacity: 0.70, fontSize: 12, marginTop: 6 }}>
                  Jelentés: {it.reportIds.join(", ") || "—"} • Tagek: {it.tags.join(", ") || "—"}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div style={{ border: "1px solid rgba(255,255,255,0.10)", background: "rgba(0,0,0,0.16)", padding: 12 }}>
        <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 10 }}>Részletek</div>

        {!selected ? (
          <div style={{ opacity: 0.7 }}>Válassz egy bizonyítékot balról.</div>
        ) : (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 16 }}>{selected.title}</div>
                <div style={{ opacity: 0.75, fontSize: 12 }}>
                  {selected.id} • {selected.type} • {statusLabel(selected.status)}
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <button className="hpx-btn" onClick={addNoteEvent} disabled={selected.status === "SEALED"}>
                  Megjegyzés
                </button>
                <button className="hpx-btn" onClick={sealEvidence} disabled={selected.status === "SEALED"}>
                  Lepecsételés
                </button>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 6 }}>Jegyzet</div>
              <textarea
                value={selected.note}
                onChange={(e) => updateItem(selected.id, { note: e.target.value })}
                disabled={selected.status === "SEALED"}
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

            <div style={{ marginTop: 12 }}>
              <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 6 }}>Tagek (vesszővel)</div>
              <input
                value={editTags}
                onChange={(e) => setEditTags(e.target.value)}
                disabled={selected.status === "SEALED"}
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

            <div style={{ marginTop: 12 }}>
              <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 6 }}>Kapcsolt jelentések (ID-k, vesszővel)</div>
              <input
                value={editReportIds}
                onChange={(e) => setEditReportIds(e.target.value)}
                disabled={selected.status === "SEALED"}
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
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
                <button className="hpx-btn hpx-btnAccent" onClick={applyLinks} disabled={selected.status === "SEALED"}>
                  Mentés (tagek + linkek)
                </button>
                <button
                  className="hpx-btn"
                  onClick={() => {
                    if (!contextReportId.trim()) return;
                    const list = new Set(normalizeReportIds(editReportIds));
                    list.add(contextReportId.trim());
                    setEditReportIds(Array.from(list).join(", "));
                  }}
                  disabled={selected.status === "SEALED"}
                  title="A fent beállított MDT report ID-t hozzáadja"
                >
                  + MDT report
                </button>
              </div>
            </div>

            <div style={{ marginTop: 14, border: "1px solid rgba(255,255,255,0.10)", padding: 10 }}>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>Átadás (chain-of-custody)</div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <input
                  value={transferHolder}
                  onChange={(e) => setTransferHolder(e.target.value)}
                  placeholder="Kinek (pl. Raktár, Lab, A-01)…"
                  disabled={selected.status === "SEALED"}
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

                <input
                  value={transferNote}
                  onChange={(e) => setTransferNote(e.target.value)}
                  placeholder="Megjegyzés (opcionális)…"
                  disabled={selected.status === "SEALED"}
                  style={{
                    width: "min(260px, 100%)",
                    padding: "10px 10px",
                    borderRadius: 0,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(0,0,0,0.18)",
                    color: "rgba(255,255,255,0.92)",
                    outline: "none",
                  }}
                />

                <button className="hpx-btn hpx-btnAccent" onClick={transferEvidence} disabled={selected.status === "SEALED" || !transferHolder.trim()}>
                  Átadás
                </button>
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>Timeline</div>
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

              {selected.status === "SEALED" && (
                <div style={{ marginTop: 10, opacity: 0.7, fontSize: 12 }}>
                  Lepecsételve: szerkesztés tiltva.
                </div>
              )}
            </div>

            <div style={{ marginTop: 12, opacity: 0.7, fontSize: 12 }}>
              Következő: inventory item ID + metadata + képek + jogosultság + DB.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
