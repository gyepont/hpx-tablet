import { useMemo, useState } from "react";
import { useLocalStorageState } from "../../core/ui/useLocalStorage";

type CaseStatus = "Nyitott" | "Felfüggesztve" | "Lezárt";
type CasePriority = "Alacsony" | "Közepes" | "Magas" | "Kritikus";

type CaseItem = {
  id: string;

  title: string;
  location: string;

  status: CaseStatus;
  priority: CasePriority;

  tags: string[];

  linkedReportIds: string[];
  linkedEvidenceIds: string[];
  linkedBoloIds: string[];

  linkedCids: number[];
  linkedPlates: string[];

  createdAt: string;
  updatedAt: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(): string {
  return Math.random().toString(16).slice(2, 8).toUpperCase();
}

function normalizeTags(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 24);
}

export default function CasesApp() {
  const [cases, setCases] = useLocalStorageState<CaseItem[]>("hpx:cases:v1", []);
  const [selectedId, setSelectedId] = useState<string | null>(cases[0]?.id ?? null);

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<CaseStatus | "ALL">("ALL");

  const [newTitle, setNewTitle] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newPriority, setNewPriority] = useState<CasePriority>("Közepes");
  const [newTags, setNewTags] = useState("");

  const selected = useMemo(() => cases.find((c) => c.id === selectedId) ?? null, [cases, selectedId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return cases.filter((c) => {
      if (status !== "ALL" && c.status !== status) return false;
      if (!q) return true;

      const hay = [
        c.id,
        c.title,
        c.location,
        c.tags.join(" "),
        c.linkedReportIds.join(" "),
        c.linkedEvidenceIds.join(" "),
        c.linkedBoloIds.join(" "),
        c.linkedCids.join(" "),
        c.linkedPlates.join(" "),
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(q);
    });
  }, [cases, query, status]);

  function createCase(): void {
    const title = newTitle.trim();
    if (!title) return;

    const item: CaseItem = {
      id: makeId(),
      title,
      location: newLocation.trim() || "—",
      status: "Nyitott",
      priority: newPriority,
      tags: normalizeTags(newTags),

      linkedReportIds: [],
      linkedEvidenceIds: [],
      linkedBoloIds: [],
      linkedCids: [],
      linkedPlates: [],

      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    setCases([item, ...cases]);
    setSelectedId(item.id);

    setNewTitle("");
    setNewLocation("");
    setNewPriority("Közepes");
    setNewTags("");
  }

  function updateSelected(patch: Partial<CaseItem>): void {
    if (!selected) return;

    const next = cases.map((c) => {
      if (c.id !== selected.id) return c;
      return { ...c, ...patch, updatedAt: nowIso() };
    });

    setCases(next);
  }

  function removeSelected(): void {
    if (!selected) return;

    const next = cases.filter((c) => c.id !== selected.id);
    setCases(next);
    setSelectedId(next[0]?.id ?? null);
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "0.9fr 1.1fr", gap: 12 }}>
      <div style={{ border: "1px solid rgba(255,255,255,0.10)", background: "rgba(0,0,0,0.16)", padding: 12 }}>
        <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 10 }}>Ügyek</div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Keresés (ID / cím / tag / linkek)…"
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
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
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
            <option value="Nyitott">Nyitott</option>
            <option value="Felfüggesztve">Felfüggesztve</option>
            <option value="Lezárt">Lezárt</option>
          </select>
        </div>

        <div style={{ border: "1px solid rgba(255,216,76,0.20)", padding: 10, marginBottom: 12 }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Új ügy</div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Ügy címe…"
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
              value={newLocation}
              onChange={(e) => setNewLocation(e.target.value)}
              placeholder="Helyszín…"
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

            <select
              value={newPriority}
              onChange={(e) => setNewPriority(e.target.value as CasePriority)}
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

            <input
              value={newTags}
              onChange={(e) => setNewTags(e.target.value)}
              placeholder="Tagek (vesszővel)…"
              style={{
                width: "min(280px, 100%)",
                padding: "10px 10px",
                borderRadius: 0,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(0,0,0,0.18)",
                color: "rgba(255,255,255,0.92)",
                outline: "none",
              }}
            />

            <button className="hpx-btn hpx-btnAccent" onClick={createCase} style={{ whiteSpace: "nowrap" }}>
              Létrehozás
            </button>
          </div>

          <div style={{ marginTop: 8, opacity: 0.7, fontSize: 12 }}>
            (MVP) Most localStorage-ban mentünk. Később RPC/DB.
          </div>
        </div>

        {filtered.length === 0 ? (
          <div style={{ opacity: 0.7 }}>Nincs ügy.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.slice(0, 60).map((c) => {
              const active = c.id === selectedId;
              const border = active ? "rgba(255,216,76,0.35)" : "rgba(255,255,255,0.10)";

              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  style={{
                    border: `1px solid ${border}`,
                    background: "rgba(0,0,0,0.12)",
                    padding: 10,
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ fontWeight: 900 }}>{c.title}</div>
                    <div style={{ opacity: 0.7, fontSize: 12 }}>ID: {c.id}</div>
                  </div>

                  <div style={{ opacity: 0.75, fontSize: 12, marginTop: 6 }}>
                    Státusz: {c.status} • Prioritás: {c.priority} • Helyszín: {c.location}
                  </div>

                  <div style={{ opacity: 0.75, fontSize: 12, marginTop: 6 }}>
                    Tagek: {c.tags.join(", ") || "—"}
                  </div>

                  <div style={{ opacity: 0.75, fontSize: 12, marginTop: 6 }}>
                    Linkek: Report {c.linkedReportIds.length} • Evidence {c.linkedEvidenceIds.length} • BOLO {c.linkedBoloIds.length}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ border: "1px solid rgba(255,255,255,0.10)", background: "rgba(0,0,0,0.16)", padding: 12 }}>
        <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 10 }}>Részletek</div>

        {!selected ? (
          <div style={{ opacity: 0.7 }}>Válassz egy ügyet balról.</div>
        ) : (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 18 }}>{selected.title}</div>
                <div style={{ opacity: 0.7, fontSize: 12, marginTop: 6 }}>
                  ID: {selected.id} • Létrehozva: {selected.createdAt.slice(0, 19).replace("T", " ")}
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button className="hpx-btn" onClick={removeSelected} title="Törlés (csak MVP)">
                  Törlés
                </button>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
              <select
                value={selected.status}
                onChange={(e) => updateSelected({ status: e.target.value as CaseStatus })}
                style={{
                  padding: "10px 10px",
                  borderRadius: 0,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(0,0,0,0.18)",
                  color: "rgba(255,255,255,0.92)",
                  outline: "none",
                }}
              >
                <option value="Nyitott">Nyitott</option>
                <option value="Felfüggesztve">Felfüggesztve</option>
                <option value="Lezárt">Lezárt</option>
              </select>

              <select
                value={selected.priority}
                onChange={(e) => updateSelected({ priority: e.target.value as CasePriority })}
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

              <input
                value={selected.location}
                onChange={(e) => updateSelected({ location: e.target.value })}
                placeholder="Helyszín…"
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
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 6 }}>Tagek (vesszővel)</div>
              <input
                value={selected.tags.join(", ")}
                onChange={(e) => updateSelected({ tags: normalizeTags(e.target.value) })}
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

            <div style={{ marginTop: 14, opacity: 0.75, fontSize: 12 }}>
              Következő lépések (később):
              <div>• Report/Evidence/BOLO linkelés UI (ID-k alapján)</div>
              <div>• „Ügy nézet” a MDT-ben (dispatchből kattintva)</div>
              <div>• Inventory/DB integráció: evidence → item, custody → log</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
