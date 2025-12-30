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

type EvidenceItem = {
  id: string;
  type: string;
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

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(prefix = "EVE"): string {
  return `${prefix}-${Math.random().toString(16).slice(2, 10)}-${Date.now().toString(16)}`;
}

function loadEvidence(): EvidenceItem[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as EvidenceItem[]) : [];
  } catch {
    return [];
  }
}

function saveEvidence(items: EvidenceItem[]): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(items));
  } catch {
    // no-op
  }
}

export default function LinkedEvidencePanel(props: { reportId: string; disabled: boolean }) {
  const { reportId, disabled } = props;

  const [items, setItems] = useState<EvidenceItem[]>(() => loadEvidence());
  const [evidenceIdInput, setEvidenceIdInput] = useState<string>("");
  const [linkNoteInput, setLinkNoteInput] = useState<string>("");

  useEffect(() => {
    // Magyar komment: ha más app módosítja a storage-t, frissüljünk
    const onStorage = (ev: StorageEvent) => {
      if (ev.key !== STORE_KEY) return;
      setItems(loadEvidence());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const linked = useMemo(() => {
    return items.filter((x) => Array.isArray(x.reportIds) && x.reportIds.includes(reportId));
  }, [items, reportId]);

  function updateAll(next: EvidenceItem[]) {
    setItems(next);
    saveEvidence(next);
  }

  function linkEvidence() {
    const evidenceId = evidenceIdInput.trim();
    if (!evidenceId) return;

    const found = items.find((x) => x.id === evidenceId);
    if (!found) {
      window.postMessage({ type: "hpx:notify", title: "Bizonyíték", message: "Nincs ilyen Evidence ID.", level: "warning" }, "*");
      return;
    }
    if (found.status === "SEALED") {
      window.postMessage({ type: "hpx:notify", title: "Bizonyíték", message: "Lepecsételt bizonyíték nem linkelhető.", level: "warning" }, "*");
      return;
    }

    const next = items.map((x) => {
      if (x.id !== evidenceId) return x;

      const reportIds = Array.from(new Set([...(x.reportIds ?? []), reportId]));
      const ev: EvidenceEvent = {
        id: makeId("EVE"),
        ts: nowIso(),
        action: "Megjegyzés",
        by: "MDT",
        note: `Report link hozzáadva: ${reportId}${linkNoteInput.trim() ? " • " + linkNoteInput.trim() : ""}`,
      };

      return { ...x, reportIds, events: [ev, ...(x.events ?? [])], updatedAt: nowIso() };
    });

    updateAll(next);
    setEvidenceIdInput("");
    setLinkNoteInput("");
    window.postMessage({ type: "hpx:notify", title: "Bizonyíték", message: "Linkelve a jelentéshez.", level: "success" }, "*");
  }

  function unlinkEvidence(evidenceId: string) {
    const found = items.find((x) => x.id === evidenceId);
    if (!found) return;
    if (found.status === "SEALED") {
      window.postMessage({ type: "hpx:notify", title: "Bizonyíték", message: "Lepecsételt bizonyítékról nem törlünk linket.", level: "warning" }, "*");
      return;
    }

    const next = items.map((x) => {
      if (x.id !== evidenceId) return x;

      const reportIds = (x.reportIds ?? []).filter((r) => r !== reportId);
      const ev: EvidenceEvent = {
        id: makeId("EVE"),
        ts: nowIso(),
        action: "Megjegyzés",
        by: "MDT",
        note: `Report link törölve: ${reportId}`,
      };

      return { ...x, reportIds, events: [ev, ...(x.events ?? [])], updatedAt: nowIso() };
    });

    updateAll(next);
    window.postMessage({ type: "hpx:notify", title: "Bizonyíték", message: "Link törölve.", level: "info" }, "*");
  }

  return (
    <div style={{ border: "1px solid rgba(255,255,255,0.10)", padding: 10, marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontWeight: 900 }}>Kapcsolt bizonyítékok</div>
        <div style={{ opacity: 0.7, fontSize: 12 }}>Report: {reportId}</div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
        <input
          value={evidenceIdInput}
          onChange={(e) => setEvidenceIdInput(e.target.value)}
          placeholder="Evidence ID (EV-...)"
          disabled={disabled}
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
        <input
          value={linkNoteInput}
          onChange={(e) => setLinkNoteInput(e.target.value)}
          placeholder="Megjegyzés (opcionális)"
          disabled={disabled}
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
        <button className="hpx-btn hpx-btnAccent" onClick={linkEvidence} disabled={disabled || !evidenceIdInput.trim()}>
          Linkelés
        </button>
      </div>

      <div style={{ marginTop: 10, opacity: 0.7, fontSize: 12 }}>
        Tipp: a bizonyítékot a “Bizonyítékok” appban hozza létre a lab/forensic, itt csak linkeljük az ügyhöz/jelentéshez.
      </div>

      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        {linked.length === 0 ? (
          <div style={{ opacity: 0.7 }}>Nincs linkelt bizonyíték.</div>
        ) : (
          linked.slice(0, 40).map((e) => (
            <div key={e.id} style={{ border: "1px solid rgba(255,255,255,0.10)", padding: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div style={{ fontWeight: 900 }}>{e.title}</div>
                <div style={{ opacity: 0.7, fontSize: 12 }}>{e.id}</div>
              </div>
              <div style={{ opacity: 0.78, fontSize: 12, marginTop: 6 }}>
                {e.type} • {e.status === "OPEN" ? "Nyitott" : "Lepecsételve"} • Holder: {e.holderLabel}
              </div>
              <div style={{ opacity: 0.70, fontSize: 12, marginTop: 6 }}>
                Tagek: {e.tags?.join(", ") || "—"}
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
                <button className="hpx-btn" onClick={() => navigator.clipboard.writeText(e.id)}>
                  ID másolás
                </button>
                <button className="hpx-btn" onClick={() => unlinkEvidence(e.id)} disabled={disabled || e.status === "SEALED"}>
                  Link törlés
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
