import { useEffect, useMemo, useState } from "react";

type EvidenceStatus = "NYITOTT" | "SEALED";

type EvidenceEventAction =
  | "Létrehozva"
  | "Mentve"
  | "Átadva"
  | "Lepecsételve"
  | "Ügy linkelve"
  | "Jelentéshez rendelve"
  | "Jelentésről leválasztva";

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
  type?: string | null;
  status?: EvidenceStatus | string | null;

  holder?: string | null;
  note?: string | null;
  tags?: string[];

  reportId?: string | null;
  caseId?: string | null;

  createdAt?: string | null;
  updatedAt?: string | null;

  events?: EvidenceEvent[];
};

type CaseRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

type CaseRequest = {
  id: string;
  ts: string;
  reportId: string;
  reportTitle: string;
  note?: string | null;
  createdBy: string;
  status: CaseRequestStatus;
};

type ViewMode = "KAPCSOLT" | "KERESÉS";

const EVIDENCE_KEY = "hpx:evidence:v1";
const OPEN_EVIDENCE_KEY = "hpx:evidence:openEvidenceId:v1";
const REQUESTS_KEY = "hpx:cases:requests:v1";

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
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

function notify(title: string, message: string, level: "info" | "success" | "warning" | "error" = "info") {
  window.postMessage({ type: "hpx:notify", title, message, level }, "*");
}

function normalizeEvidenceList(raw: unknown): EvidenceItem[] {
  const arr = Array.isArray(raw) ? raw : [];
  return arr
    .filter((x) => x && typeof x === "object")
    .map((x) => x as EvidenceItem)
    .filter((x) => typeof x.id === "string")
    .map((x) => ({
      id: x.id,
      label: typeof x.label === "string" ? x.label : "Bizonyíték",
      type: typeof x.type === "string" ? x.type : null,
      status: (x.status ?? "NYITOTT") as string,

      holder: typeof x.holder === "string" ? x.holder : null,
      note: typeof x.note === "string" ? x.note : null,
      tags: Array.isArray(x.tags) ? x.tags.filter((t) => typeof t === "string") : [],

      reportId: x.reportId ?? null,
      caseId: x.caseId ?? null,

      createdAt: typeof x.createdAt === "string" ? x.createdAt : null,
      updatedAt: typeof x.updatedAt === "string" ? x.updatedAt : null,

      events: Array.isArray(x.events) ? (x.events.filter(Boolean) as EvidenceEvent[]) : [],
    }))
    .sort((a, b) => {
      const ta = a.updatedAt ?? a.createdAt ?? "";
      const tb = b.updatedAt ?? b.createdAt ?? "";
      return ta < tb ? 1 : -1;
    });
}

function pushEvent(e: EvidenceItem, action: EvidenceEventAction, by: string, note?: string | null): EvidenceItem {
  const events = Array.isArray(e.events) ? e.events : [];
  const nextEv: EvidenceEvent = {
    id: makeId(),
    ts: nowIso(),
    action,
    by,
    holder: e.holder ?? null,
    note: note ?? null,
  };
  return { ...e, events: [nextEv, ...events].slice(0, 80) };
}

function requestCaseFromReport(reportId: string, reportTitle: string, actorName: string): void {
  const note = (prompt("Ügy javaslat indoklás (opcionális):", "") ?? "").trim() || null;

  const req: CaseRequest = {
    id: makeId(),
    ts: nowIso(),
    reportId,
    reportTitle,
    note,
    createdBy: actorName,
    status: "PENDING",
  };

  const raw = safeParseJson<unknown>(localStorage.getItem(REQUESTS_KEY), []);
  const arr = Array.isArray(raw) ? raw : [];
  const next = [req, ...arr].slice(0, 200);

  try {
    localStorage.setItem(REQUESTS_KEY, JSON.stringify(next));
  } catch {
    // no-op
  }

  notify("Iktatás", "Ügy javaslat leadva (Iktatás appban jóváhagyható).", "success");
}

export default function ReportEvidencePanel(props: { reportId: string; reportTitle?: string; actorName: string }) {
  const { reportId, reportTitle, actorName } = props;

  // Magyar komment: alapból csukva → nem foglalja el a fél képernyőt
  const [open, setOpen] = useState<boolean>(false);
  const [view, setView] = useState<ViewMode>("KAPCSOLT");

  const [items, setItems] = useState<EvidenceItem[]>(() => {
    const raw = safeParseJson<unknown>(localStorage.getItem(EVIDENCE_KEY), []);
    return normalizeEvidenceList(raw);
  });

  const [q, setQ] = useState<string>("");

  useEffect(() => {
    // Magyar komment: csak olvasunk (poll), nem írunk gépelésre → nem spameli a timeline-t
    const t = window.setInterval(() => {
      const raw = safeParseJson<unknown>(localStorage.getItem(EVIDENCE_KEY), []);
      setItems(normalizeEvidenceList(raw));
    }, 1200);
    return () => window.clearInterval(t);
  }, []);

  const linked = useMemo(() => items.filter((e) => (e.reportId ?? "") === reportId), [items, reportId]);

  const results = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return items.slice(0, 10);

    return items
      .filter((e) => {
        const hay = [
          e.id,
          e.label,
          e.type ?? "",
          e.status ?? "",
          e.holder ?? "",
          e.note ?? "",
          (e.tags ?? []).join(" "),
          e.reportId ?? "",
          e.caseId ?? "",
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(qq);
      })
      .slice(0, 14);
  }, [items, q]);

  function writeAll(next: EvidenceItem[]): void {
    setItems(next);
    persistEvidence(next);
  }

  function openEvidence(evidenceId: string): void {
    try {
      localStorage.setItem(OPEN_EVIDENCE_KEY, JSON.stringify(evidenceId));
    } catch {
      // no-op
    }
    notify("Bizonyítékok", "Nyisd meg a Bizonyítékok appot (rá fog állni).", "info");
  }

  function linkEvidence(evidenceId: string): void {
    const next = items.map((e) => {
      if (e.id !== evidenceId) return e;

      const already = (e.reportId ?? "") === reportId;
      if (already) return e;

      const updated: EvidenceItem = {
        ...e,
        reportId,
        updatedAt: nowIso(),
      };

      return pushEvent(updated, "Jelentéshez rendelve", actorName, `Jelentés: ${reportId}`);
    });

    writeAll(next);
    notify("MDT • Bizonyítékok", "Hozzárendelve a jelentéshez.", "success");
  }

  function unlinkEvidence(evidenceId: string): void {
    const next = items.map((e) => {
      if (e.id !== evidenceId) return e;

      const st = String(e.status ?? "NYITOTT");
      if (st === "SEALED") return e;

      const updated: EvidenceItem = {
        ...e,
        reportId: null,
        updatedAt: nowIso(),
      };

      return pushEvent(updated, "Jelentésről leválasztva", actorName, `Jelentés: ${reportId}`);
    });

    writeAll(next);
    notify("MDT • Bizonyítékok", "Leválasztva a jelentésről.", "info");
  }

  const caseTitle = (reportTitle && reportTitle.trim()) ? reportTitle.trim() : `Jelentés • ${reportId}`;

  function EvidenceRow(propsRow: { e: EvidenceItem; showReport: boolean }) {
    const { e, showReport } = propsRow;
    const isLinked = (e.reportId ?? "") === reportId;
    const sealed = String(e.status ?? "NYITOTT") === "SEALED";

    return (
      <div style={{ border: "1px solid rgba(255,255,255,0.10)", padding: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 900 }}>{e.label}</div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>
            {String(e.type ?? "—")} • {String(e.status ?? "—")}
          </div>
        </div>

        <div style={{ opacity: 0.72, fontSize: 12, marginTop: 6 }}>
          ID: {e.id}
          {" • "}
          Birtokos: <b>{e.holder ?? "—"}</b>
          {showReport && (
            <>
              {" • "}
              Jelentés: <b>{e.reportId ?? "—"}</b>
            </>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          {!isLinked ? (
            <button className="hpx-btn hpx-btnAccent" onClick={() => linkEvidence(e.id)}>
              Hozzárendelés
            </button>
          ) : (
            <button className="hpx-btn" onClick={() => unlinkEvidence(e.id)} disabled={sealed} style={{ opacity: sealed ? 0.55 : 1 }}>
              Leválasztás
            </button>
          )}

          <button className="hpx-btn" onClick={() => openEvidence(e.id)}>Megnyitás</button>
        </div>

        {sealed && isLinked && (
          <div style={{ marginTop: 8, opacity: 0.7, fontSize: 12 }}>
            Lepecsételt bizonyíték: leválasztás tiltva.
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ border: "1px solid rgba(255,255,255,0.10)", padding: 10, marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <div style={{ fontWeight: 900 }}>Bizonyítékok</div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>
            Kapcsolt: <b>{linked.length}</b> • Jelentés ID: <b>{reportId}</b>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="hpx-btn" onClick={() => requestCaseFromReport(reportId, caseTitle, actorName)}>Ügy javaslat</button>
          <button className="hpx-btn hpx-btnAccent" onClick={() => setOpen((v) => !v)}>
            {open ? "Bezár" : "Megnyit"}
          </button>
        </div>
      </div>

      {!open ? (
        <div style={{ marginTop: 10, opacity: 0.75, fontSize: 12 }}>
          (Összecsukva) Nyisd meg, ha linkelni vagy keresni akarsz.
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
            <button className={`hpx-btn ${view === "KAPCSOLT" ? "hpx-btnAccent" : ""}`} onClick={() => setView("KAPCSOLT")}>
              Kapcsolt ({linked.length})
            </button>
            <button className={`hpx-btn ${view === "KERESÉS" ? "hpx-btnAccent" : ""}`} onClick={() => setView("KERESÉS")}>
              Keresés / Hozzárendelés
            </button>
          </div>

          {view === "KAPCSOLT" && (
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8, maxHeight: 260, overflow: "auto" }}>
              {linked.length === 0 ? (
                <div style={{ opacity: 0.7, fontSize: 13 }}>Nincs még kapcsolt bizonyíték.</div>
              ) : (
                linked.slice(0, 20).map((e) => <EvidenceRow key={e.id} e={e} showReport={false} />)
              )}
            </div>
          )}

          {view === "KERESÉS" && (
            <div style={{ marginTop: 10 }}>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Keresés (név / ID / tag / birtokos)…"
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

              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8, maxHeight: 280, overflow: "auto" }}>
                {results.map((e) => <EvidenceRow key={e.id} e={e} showReport={true} />)}
              </div>

              <div style={{ marginTop: 10, opacity: 0.65, fontSize: 12 }}>
                Audit csak műveleteknél íródik (nem gépelésre).
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
