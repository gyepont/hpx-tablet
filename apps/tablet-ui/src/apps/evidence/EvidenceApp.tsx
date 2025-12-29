import { useMemo, useState } from "react";
import { useLocalStorageState } from "../../core/ui/useLocalStorage";

type EvidenceAction = "Létrehozva" | "Megjegyzés" | "Átadva" | "Lepecsételve";

type EvidenceStatus = "Nyitott" | "Lepecsételt";

type EvidenceEvent = {
  id: string;
  ts: string;
  action: EvidenceAction | string;
  by: string;
  note?: string | null;
  holder?: string | null;
};

type EvidenceItem = {
  id: string;
  label: string;
  reportId?: string | null;
  status: EvidenceStatus;
  holder: string;
  createdAt: string;
  createdBy: string;
  tags: string[];
  events: EvidenceEvent[];
};

const STORAGE_ITEMS = "hpx:evidence:items:v1";
const STORAGE_LAST_REPORT = "hpx:evidence:lastReportId:v1";

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(prefix: string): string {
  return `${prefix}-${Math.random().toString(16).slice(2, 10)}${Math.random().toString(16).slice(2, 6)}`;
}

function safeTrim(v: unknown): string {
  return String(v ?? "").trim();
}

export default function EvidenceApp() {
  const [items, setItems] = useLocalStorageState<EvidenceItem[]>(STORAGE_ITEMS, []);
  const [linkedReportId, setLinkedReportId] = useLocalStorageState<string>(STORAGE_LAST_REPORT, "");
  const [query, setQuery] = useState<string>("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rid = linkedReportId.trim();

    return items
      .filter((x) => {
        if (rid && (x.reportId ?? "") !== rid) return false;
        if (!q) return true;
        const hay = `${x.id} ${x.label} ${x.holder} ${(x.reportId ?? "")} ${x.tags.join(" ")}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [items, linkedReportId, query]);

  const selected = useMemo(() => {
    const id = selectedId ?? (filtered[0]?.id ?? null);
    if (!id) return null;
    return filtered.find((x) => x.id === id) ?? null;
  }, [filtered, selectedId]);

  function select(id: string) {
    setSelectedId(id);
  }

  function createEvidence() {
    const label = safeTrim(prompt("Bizonyíték neve / címke:", "Zacskó / Fotó / Tárgy"));
    if (!label) return;

    const holder = safeTrim(prompt("Jelenlegi őrző (pl. 'A-01', 'Raktár', 'Evidence Locker'):", "Evidence Locker")) || "Evidence Locker";
    const by = "Tablet";

    const reportId = linkedReportId.trim() ? linkedReportId.trim() : null;

    const item: EvidenceItem = {
      id: makeId("EVD"),
      label,
      reportId,
      status: "Nyitott",
      holder,
      createdAt: nowIso(),
      createdBy: by,
      tags: [],
      events: [
        {
          id: makeId("EVT"),
          ts: nowIso(),
          action: "Létrehozva" as const,
          by,
          note: reportId ? `Kapcsolva: ${reportId}` : null,
          holder,
        },
      ],
    };

    setItems((prev) => [item, ...prev].slice(0, 300));
    setSelectedId(item.id);
  }

  function addNote() {
    if (!selected) return;
    const note = safeTrim(prompt("Megjegyzés:", ""));
    if (!note) return;

    const updated: EvidenceItem = {
      ...selected,
      events: [
        { id: makeId("EVT"), ts: nowIso(), action: "Megjegyzés" as const, by: "Tablet", note, holder: selected.holder },
        ...selected.events,
      ].slice(0, 120),
    };

    setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
  }

  function transfer() {
    if (!selected) return;
    if (selected.status === "Lepecsételt") return;

    const nextHolder = safeTrim(prompt("Átadás kinek / hová:", selected.holder));
    if (!nextHolder) return;

    const note = safeTrim(prompt("Átadás megjegyzés (opcionális):", ""));

    const updated: EvidenceItem = {
      ...selected,
      holder: nextHolder,
      events: [
        {
          id: makeId("EVT"),
          ts: nowIso(),
          action: "Átadva" as const,
          by: "Tablet",
          note: note || null,
          holder: nextHolder,
        },
        ...selected.events,
      ].slice(0, 120),
    };

    setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
  }

  function seal() {
    if (!selected) return;
    if (selected.status === "Lepecsételt") return;

    const updated: EvidenceItem = {
      ...selected,
      status: "Lepecsételt",
      events: [
        { id: makeId("EVT"), ts: nowIso(), action: "Lepecsételve" as const, by: "Tablet", note: null, holder: selected.holder },
        ...selected.events,
      ].slice(0, 120),
    };

    setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
  }

  function clearReportFilter() {
    setLinkedReportId("");
  }

  return (
    <div>
      <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 10 }}>Bizonyítékok</div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <button className="hpx-btn hpx-btnAccent" onClick={createEvidence}>Új bizonyíték</button>
        <button className="hpx-btn" onClick={addNote} disabled={!selected}>Megjegyzés</button>
        <button className="hpx-btn" onClick={transfer} disabled={!selected || selected?.status === "Lepecsételt"}>Átadás</button>
        <button className="hpx-btn" onClick={seal} disabled={!selected || selected?.status === "Lepecsételt"}>Lepecsétel</button>
      </div>

      <div style={{ border: "1px solid rgba(255,255,255,0.10)", background: "rgba(0,0,0,0.16)", padding: 12, marginBottom: 10 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Kapcsolt jelentés:</div>
          <div style={{ fontWeight: 900 }}>{linkedReportId.trim() ? linkedReportId.trim() : "—"}</div>
          {linkedReportId.trim() && (
            <button className="hpx-btn" onClick={clearReportFilter}>Szűrés törlése</button>
          )}

          <div style={{ flex: 1 }} />

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Keresés (ID, címke, őrző, report ID)…"
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
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "0.9fr 1.1fr", gap: 12 }}>
        <div style={{ border: "1px solid rgba(255,255,255,0.10)", padding: 10 }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Lista ({filtered.length})</div>

          {filtered.length === 0 ? (
            <div style={{ opacity: 0.7 }}>Nincs találat.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filtered.slice(0, 120).map((x) => {
                const active = selected?.id === x.id;
                const border = x.status === "Lepecsételt" ? "rgba(47,232,110,0.25)" : "rgba(255,255,255,0.10)";
                return (
                  <div
                    key={x.id}
                    onClick={() => select(x.id)}
                    style={{
                      border: `1px solid ${border}`,
                      padding: 10,
                      cursor: "pointer",
                      boxShadow: active ? "0 0 0 3px rgba(255,216,76,0.10)" : "none",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ fontWeight: 900 }}>{x.id} • {x.label}</div>
                      <div style={{ opacity: 0.75, fontSize: 12 }}>{x.status}</div>
                    </div>
                    <div style={{ opacity: 0.75, fontSize: 12, marginTop: 6 }}>
                      Őrző: <b>{x.holder}</b> • Jelentés: <b>{x.reportId ?? "—"}</b>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ border: "1px solid rgba(255,255,255,0.10)", padding: 10 }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Részletek</div>

          {!selected ? (
            <div style={{ opacity: 0.7 }}>Válassz egy bizonyítékot balról.</div>
          ) : (
            <div>
              <div style={{ fontWeight: 900, fontSize: 16 }}>{selected.id} • {selected.label}</div>
              <div style={{ opacity: 0.75, fontSize: 12, marginTop: 6 }}>
                Állapot: <b>{selected.status}</b> • Őrző: <b>{selected.holder}</b>
              </div>
              <div style={{ opacity: 0.75, fontSize: 12, marginTop: 6 }}>
                Létrehozva: <b>{selected.createdAt}</b> • Létrehozó: <b>{selected.createdBy}</b>
              </div>
              <div style={{ opacity: 0.75, fontSize: 12, marginTop: 6 }}>
                Kapcsolt jelentés: <b>{selected.reportId ?? "—"}</b>
              </div>

              <div style={{ fontWeight: 900, marginTop: 12, marginBottom: 6 }}>Chain-of-custody</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {selected.events.map((e) => (
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

              <div style={{ marginTop: 12, opacity: 0.7, fontSize: 12 }}>
                Következő lépés: inventory item ID + metadata + képek + jogosultság + DB.
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 10, opacity: 0.65, fontSize: 12 }}>
        Tipp: az MDT-ben egy jelentés megnyitása automatikusan beállítja a “Kapcsolt jelentés” kontextust.
      </div>
    </div>
  );
}
