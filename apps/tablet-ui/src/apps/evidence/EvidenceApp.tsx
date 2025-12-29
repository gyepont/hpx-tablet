import { useEffect, useMemo, useState } from "react";
import { getRpcTransportKind, rpcCall } from "../../core/rpc/client";

type EvidenceStatus = "OPEN" | "SEALED";
type EvidenceType = "Tárgy" | "Fotó" | "Videó" | "Dokumentum" | "Egyéb";

type EvidenceTimelineItem = {
  id: string;
  ts: string;
  action: string;
  note?: string | null;
  actorName?: string | null;
};

type EvidenceItem = {
  id: string;
  type: EvidenceType;
  title: string;
  note: string;
  tags: string[];
  reportIds: string[];
  status: EvidenceStatus;
  holderLabel: string;
  createdAt: string;
  updatedAt: string;
  sealedAt?: string | null;
  timeline: EvidenceTimelineItem[];
};

const LS_KEY = "hpx:evidence:v1";

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function loadLocal(): EvidenceItem[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as EvidenceItem[];
  } catch {
    return [];
  }
}

function saveLocal(items: EvidenceItem[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(items));
  } catch {
    // no-op
  }
}

function huStatus(s: EvidenceStatus): string {
  return s === "SEALED" ? "Lezárva" : "Nyitott";
}

export default function EvidenceApp() {
  const transport = useMemo(() => getRpcTransportKind(), []);
  const isNui = transport === "nui";

  const actorName = "—"; // NUI-ban később player contextből jön (most elég a backend auditba)

  const [items, setItems] = useState<EvidenceItem[]>(() => (isNui ? [] : loadLocal()));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<EvidenceStatus | "ALL">("ALL");
  const [filterType, setFilterType] = useState<EvidenceType | "ALL">("ALL");

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useMemo(() => items.find((x) => x.id === selectedId) ?? null, [items, selectedId]);
  const isLocked = !!selected && selected.status === "SEALED";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((e) => {
      if (filterStatus !== "ALL" && e.status !== filterStatus) return false;
      if (filterType !== "ALL" && e.type !== filterType) return false;
      if (!q) return true;
      return (
        e.id.toLowerCase().includes(q) ||
        e.title.toLowerCase().includes(q) ||
        e.note.toLowerCase().includes(q) ||
        e.tags.some((t) => t.toLowerCase().includes(q)) ||
        e.reportIds.some((r) => r.toLowerCase().includes(q))
      );
    });
  }, [items, query, filterStatus, filterType]);

  useEffect(() => {
    if (!isNui) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNui]);

  useEffect(() => {
    if (isNui) return;
    saveLocal(items);
  }, [items, isNui]);

  async function refresh(): Promise<void> {
    if (!isNui) return;

    setLoading(true);
    setError(null);

    try {
      const res = await rpcCall("mdt:getEvidences" as any, {
        query: query.trim() || undefined,
        limit: 200,
        status: filterStatus,
        type: filterType,
      } as any, { timeoutMs: 3500 });

      const list = (res as any).evidences as EvidenceItem[];
      setItems(list);

      if (list.length && !selectedId) setSelectedId(list[0].id);
      if (selectedId && !list.some((x) => x.id === selectedId)) setSelectedId(list.length ? list[0].id : null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function createLocal(): void {
    const type: EvidenceType = "Tárgy";
    const id = makeId();
    const ts = nowIso();

    const item: EvidenceItem = {
      id,
      type,
      title: "Új bizonyíték",
      note: "",
      tags: [],
      reportIds: [],
      status: "OPEN",
      holderLabel: "Raktár",
      createdAt: ts,
      updatedAt: ts,
      sealedAt: null,
      timeline: [{ id: makeId(), ts, action: "Létrehozva", actorName }],
    };

    setItems((prev) => [item, ...prev]);
    setSelectedId(id);
  }

  async function createNui(): Promise<void> {
    const title = (prompt("Bizonyíték címe:", "Új bizonyíték") ?? "").trim();
    if (!title) return;

    const res = await rpcCall("mdt:createEvidence" as any, {
      type: "Tárgy",
      title,
      note: "",
      tags: [],
      reportIds: [],
      actorName,
    } as any, { timeoutMs: 3500 });

    const created = (res as any).evidence as EvidenceItem;
    await refresh();
    setSelectedId(created.id);
  }

  function updateSelected(patch: Partial<EvidenceItem>): void {
    if (!selected) return;
    setItems((prev) => prev.map((x) => (x.id === selected.id ? { ...x, ...patch, updatedAt: nowIso() } : x)));
  }

  async function saveNui(): Promise<void> {
    if (!selected) return;

    const res = await rpcCall("mdt:updateEvidence" as any, {
      evidenceId: selected.id,
      title: selected.title,
      note: selected.note,
      tags: selected.tags,
      reportIds: selected.reportIds,
      actorName,
    } as any, { timeoutMs: 3500 });

    const updated = (res as any).evidence as EvidenceItem;
    setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
  }

  async function seal(): Promise<void> {
    if (!selected) return;
    if (selected.status === "SEALED") return;

    if (!confirm("Biztosan lezárod? Lezárás után csak olvasás.")) return;

    if (!isNui) {
      const ts = nowIso();
      updateSelected({
        status: "SEALED",
        sealedAt: ts,
        timeline: [{ id: makeId(), ts, action: "Lezárva", actorName }, ...selected.timeline],
      });
      return;
    }

    const res = await rpcCall("mdt:sealEvidence" as any, { evidenceId: selected.id, actorName } as any, { timeoutMs: 3500 });
    const updated = (res as any).evidence as EvidenceItem;
    setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
  }

  async function transfer(): Promise<void> {
    if (!selected) return;

    const holderLabel = (prompt("Kinek adod át? (pl. A-01 / Raktár / Evidence Locker)", selected.holderLabel) ?? "").trim();
    if (!holderLabel) return;

    const note = (prompt("Megjegyzés (opcionális):", "") ?? "").trim() || null;

    if (!isNui) {
      const ts = nowIso();
      updateSelected({
        holderLabel,
        timeline: [{ id: makeId(), ts, action: "Átadva", note, actorName }, ...selected.timeline],
      });
      return;
    }

    const res = await rpcCall("mdt:transferEvidence" as any, { evidenceId: selected.id, holderLabel, note, actorName } as any, { timeoutMs: 3500 });
    const updated = (res as any).evidence as EvidenceItem;
    setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
  }

  function setTagsFromText(text: string): void {
    const tags = text
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 20);
    updateSelected({ tags });
  }

  function setReportIdsFromText(text: string): void {
    const ids = text
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 30);
    updateSelected({ reportIds: ids });
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "420px 1fr", gap: 12 }}>
      <div style={{ border: "1px solid rgba(255,255,255,0.10)", background: "rgba(0,0,0,0.16)", padding: 12 }}>
        <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 10 }}>Bizonyítékok</div>

        <div style={{ opacity: 0.75, fontSize: 12, marginBottom: 10 }}>
          Mód: <b>{transport === "nui" ? "FiveM NUI" : "Web (mock)"}</b>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
          <button className="hpx-btn hpx-btnAccent" onClick={() => (isNui ? void createNui() : createLocal())} disabled={loading}>
            Új bizonyíték
          </button>
          <button className="hpx-btn" onClick={() => void refresh()} disabled={!isNui || loading}>
            {loading ? "Frissítés…" : "Frissítés"}
          </button>
        </div>

        {error && <div style={{ opacity: 0.85, marginBottom: 10 }}>Hiba: {error}</div>}

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Keresés (ID / cím / tag / report ID)…"
          style={{
            width: "100%",
            padding: "10px 10px",
            borderRadius: 0,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(0,0,0,0.18)",
            color: "rgba(255,255,255,0.92)",
            outline: "none",
            marginBottom: 10,
          }}
        />

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            style={{ padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none" }}
          >
            <option value="ALL">Minden státusz</option>
            <option value="OPEN">Nyitott</option>
            <option value="SEALED">Lezárva</option>
          </select>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            style={{ padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none" }}
          >
            <option value="ALL">Minden típus</option>
            <option value="Tárgy">Tárgy</option>
            <option value="Fotó">Fotó</option>
            <option value="Videó">Videó</option>
            <option value="Dokumentum">Dokumentum</option>
            <option value="Egyéb">Egyéb</option>
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.length === 0 ? (
            <div style={{ opacity: 0.7 }}>Nincs találat.</div>
          ) : (
            filtered.slice(0, 200).map((e) => (
              <div
                key={e.id}
                onClick={() => setSelectedId(e.id)}
                style={{
                  border: "1px solid rgba(255,255,255,0.10)",
                  padding: 10,
                  cursor: "pointer",
                  boxShadow: selectedId === e.id ? "0 0 0 3px rgba(255,216,76,0.10)" : "none",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ fontWeight: 900 }}>{e.type} • {e.title}</div>
                  <div style={{ opacity: 0.7, fontSize: 12 }}>{huStatus(e.status)}</div>
                </div>
                <div style={{ opacity: 0.75, fontSize: 12, marginTop: 6 }}>
                  ID: {e.id} • Holder: {e.holderLabel}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div style={{ border: "1px solid rgba(255,255,255,0.10)", background: "rgba(0,0,0,0.16)", padding: 12 }}>
        {!selected ? (
          <div style={{ opacity: 0.7 }}>Válassz egy bizonyítékot balról.</div>
        ) : (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 16 }}>{selected.title}</div>
                <div style={{ opacity: 0.75, fontSize: 12 }}>
                  Státusz: <b>{huStatus(selected.status)}</b> • Holder: <b>{selected.holderLabel}</b> • ID: <b>{selected.id}</b>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button className="hpx-btn" onClick={() => void transfer()} disabled={loading}>
                  Átadás
                </button>
                <button className="hpx-btn" onClick={() => void seal()} disabled={loading || selected.status === "SEALED"}>
                  Lezárás
                </button>
                <button className="hpx-btn hpx-btnAccent" onClick={() => void saveNui()} disabled={!isNui || loading || isLocked}>
                  Mentés
                </button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 6 }}>Cím</div>
                <input
                  value={selected.title}
                  onChange={(e) => updateSelected({ title: e.target.value })}
                  disabled={isLocked}
                  style={{ width: "100%", padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none" }}
                />
              </div>

              <div>
                <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 6 }}>Típus</div>
                <select
                  value={selected.type}
                  onChange={(e) => updateSelected({ type: e.target.value as EvidenceType })}
                  disabled={isLocked}
                  style={{ width: "100%", padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none" }}
                >
                  <option value="Tárgy">Tárgy</option>
                  <option value="Fotó">Fotó</option>
                  <option value="Videó">Videó</option>
                  <option value="Dokumentum">Dokumentum</option>
                  <option value="Egyéb">Egyéb</option>
                </select>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 6 }}>Jegyzet</div>
              <textarea
                value={selected.note}
                onChange={(e) => updateSelected({ note: e.target.value })}
                disabled={isLocked}
                style={{ width: "100%", minHeight: 110, padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none" }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
              <div>
                <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 6 }}>Tagek (vesszővel)</div>
                <input
                  value={selected.tags.join(", ")}
                  onChange={(e) => setTagsFromText(e.target.value)}
                  disabled={isLocked}
                  style={{ width: "100%", padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none" }}
                />
              </div>

              <div>
                <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 6 }}>Kapcsolt report ID-k (vesszővel)</div>
                <input
                  value={selected.reportIds.join(", ")}
                  onChange={(e) => setReportIdsFromText(e.target.value)}
                  disabled={isLocked}
                  style={{ width: "100%", padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none" }}
                />
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>Timeline</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {selected.timeline.slice(0, 60).map((t) => (
                  <div key={t.id} style={{ border: "1px solid rgba(255,255,255,0.10)", padding: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ fontWeight: 900 }}>{t.action}</div>
                      <div style={{ opacity: 0.7, fontSize: 12 }}>{t.ts}</div>
                    </div>
                    <div style={{ opacity: 0.75, fontSize: 12 }}>
                      {t.actorName ?? "—"} {t.note ? `• ${t.note}` : ""}
                    </div>
                  </div>
                ))}
              </div>
              {selected.status === "SEALED" && (
                <div style={{ marginTop: 10, opacity: 0.7, fontSize: 12 }}>
                  Lezárva: szerkesztés tiltva.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
