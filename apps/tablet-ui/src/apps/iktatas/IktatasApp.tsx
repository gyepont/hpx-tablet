import { useMemo, useState } from "react";
import { usePlayerContext } from "../../core/session/usePlayerContext";

type CaseRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

type CaseRequest = {
  id: string;
  ts: string;

  reportId: string;
  reportTitle: string;

  note?: string | null;

  createdBy: string;
  status: CaseRequestStatus;

  decidedBy?: string | null;
  decidedAt?: string | null;

  caseId?: string | null;
  caseNumber?: string | null;
};

type CaseEventAction = "Létrehozva" | "Mentve" | "Lezárva" | "Újranyitva" | "Linkelve";

type CaseEvent = {
  id: string;
  ts: string;
  action: CaseEventAction;
  by: string;
  note?: string | null;
};

type CaseItem = {
  id: string;

  caseNumber: string;
  title: string;

  status: string;   // Magyar UI: rugalmas (CasesApp majd úgyis normalizál)
  priority: string;

  location: string;
  tags: string[];

  linkedReportIds: string[];
  linkedEvidenceIds: string[];

  timeline: CaseEvent[];

  createdAt: string;
  updatedAt: string;
};

const REQUESTS_KEY = "hpx:cases:requests:v1";
const CASES_KEY = "hpx:cases:v1";
const OPEN_CASE_KEY = "hpx:cases:openCaseId:v1";

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

function persist<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // no-op
  }
}

function notify(title: string, message: string, level: "info" | "success" | "warning" | "error" = "info") {
  window.postMessage({ type: "hpx:notify", title, message, level }, "*");
}

function genCaseNumber(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const rnd = String(Math.floor(Math.random() * 9000) + 1000);
  return `IKT-${y}${m}${day}-${rnd}`;
}

export default function IktatasApp() {
  const { data: player } = usePlayerContext();
  const actorName = player?.name ?? "—";

  const [raw, setRaw] = useState<CaseRequest[]>(() => safeParseJson<CaseRequest[]>(localStorage.getItem(REQUESTS_KEY), []));
  const [selectedId, setSelectedId] = useState<string | null>(() => raw[0]?.id ?? null);

  const requests = useMemo(() => {
    return (raw ?? []).filter((x) => x && typeof x.id === "string").sort((a, b) => (a.ts < b.ts ? 1 : -1));
  }, [raw]);

  const selected = useMemo(() => requests.find((x) => x.id === selectedId) ?? null, [requests, selectedId]);

  const pending = useMemo(() => requests.filter((x) => x.status === "PENDING"), [requests]);

  function reload(): void {
    setRaw(safeParseJson<CaseRequest[]>(localStorage.getItem(REQUESTS_KEY), []));
    notify("Iktatás", "Frissítve.", "info");
  }

  function save(next: CaseRequest[]): void {
    setRaw(next);
    persist(REQUESTS_KEY, next);
  }

  function approveRequest(req: CaseRequest): void {
    const cases = safeParseJson<CaseItem[]>(localStorage.getItem(CASES_KEY), []);
    const ts = nowIso();

    const caseId = makeId();
    const caseNumber = genCaseNumber();

    const newCase: CaseItem = {
      id: caseId,
      caseNumber,
      title: req.reportTitle || `Ügy • ${req.reportId}`,
      status: "Nyitott",
      priority: "Közepes",
      location: "—",
      tags: [],
      linkedReportIds: [req.reportId],
      linkedEvidenceIds: [],
      timeline: [
        { id: makeId(), ts, action: "Létrehozva", by: actorName, note: `Javaslatból: ${req.id} • Report: ${req.reportId}` },
      ],
      createdAt: ts,
      updatedAt: ts,
    };

    persist(CASES_KEY, [newCase, ...(cases ?? [])]);

    const nextReqs = requests.map((r) =>
      r.id !== req.id
        ? r
        : {
            ...r,
            status: "APPROVED" as const,
            decidedBy: actorName,
            decidedAt: ts,
            caseId,
            caseNumber,
          }
    );

    save(nextReqs);

    try {
      localStorage.setItem(OPEN_CASE_KEY, JSON.stringify(caseId));
    } catch {}

    notify("Iktatás", `Jóváhagyva • Ügy létrehozva: ${caseNumber}`, "success");
  }

  function rejectRequest(req: CaseRequest): void {
    const reason = (prompt("Elutasítás oka (opcionális):", "") ?? "").trim() || null;
    const ts = nowIso();

    const nextReqs = requests.map((r) =>
      r.id !== req.id
        ? r
        : {
            ...r,
            status: "REJECTED" as const,
            decidedBy: actorName,
            decidedAt: ts,
            note: reason ?? r.note ?? null,
          }
    );

    save(nextReqs);
    notify("Iktatás", "Elutasítva.", "warning");
  }

  function openCaseFromApproved(req: CaseRequest): void {
    if (!req.caseId) return;
    try {
      localStorage.setItem(OPEN_CASE_KEY, JSON.stringify(req.caseId));
    } catch {}
    notify("Iktatás", "Nyisd meg az Ügyek appot (rá fog állni).", "info");
  }

  return (
    <div>
      <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 10 }}>Iktatás</div>

      <div style={{ display: "grid", gridTemplateColumns: "0.9fr 1.1fr", gap: 12 }}>
        <div style={{ border: "1px solid rgba(255,255,255,0.10)", background: "rgba(0,0,0,0.16)", padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontWeight: 900 }}>Javaslatok</div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>Függőben: <b>{pending.length}</b> • Összes: <b>{requests.length}</b></div>
            </div>
            <button className="hpx-btn" onClick={reload}>Frissítés</button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
            {requests.length === 0 ? (
              <div style={{ opacity: 0.7 }}>Nincs javaslat.</div>
            ) : (
              requests.slice(0, 60).map((r) => (
                <div
                  key={r.id}
                  onClick={() => setSelectedId(r.id)}
                  style={{
                    border: "1px solid rgba(255,255,255,0.10)",
                    padding: 10,
                    cursor: "pointer",
                    background: r.id === selectedId ? "rgba(255,216,76,0.06)" : "rgba(0,0,0,0.10)",
                    boxShadow: r.id === selectedId ? "0 0 0 3px rgba(255,216,76,0.10)" : "none",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 900 }}>{r.reportTitle || "Jelentés"}</div>
                    <div style={{ opacity: 0.7, fontSize: 12 }}>{r.status}</div>
                  </div>
                  <div style={{ opacity: 0.75, fontSize: 12, marginTop: 6 }}>
                    Report: <b>{r.reportId}</b> • {r.createdBy} • {r.ts.slice(11, 19)}
                  </div>
                  {r.caseNumber && (
                    <div style={{ opacity: 0.75, fontSize: 12, marginTop: 4 }}>
                      Ügy: <b>{r.caseNumber}</b>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div style={{ border: "1px solid rgba(255,255,255,0.10)", background: "rgba(0,0,0,0.16)", padding: 12 }}>
          {!selected ? (
            <div style={{ opacity: 0.7 }}>Válassz egy javaslatot.</div>
          ) : (
            <div>
              <div style={{ fontWeight: 900, fontSize: 16 }}>{selected.reportTitle || "Jelentés"}</div>
              <div style={{ opacity: 0.7, fontSize: 12, marginTop: 6 }}>
                Javaslat ID: {selected.id}
              </div>
              <div style={{ opacity: 0.75, fontSize: 12, marginTop: 6 }}>
                Report ID: <b>{selected.reportId}</b>
              </div>

              <div style={{ marginTop: 10, opacity: 0.78 }}>
                {selected.note ? selected.note : "—"}
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                {selected.status === "PENDING" && (
                  <>
                    <button className="hpx-btn hpx-btnAccent" onClick={() => approveRequest(selected)}>Jóváhagyás (Ügy létrehozás)</button>
                    <button className="hpx-btn" onClick={() => rejectRequest(selected)}>Elutasítás</button>
                  </>
                )}

                {selected.status === "APPROVED" && (
                  <button className="hpx-btn hpx-btnAccent" onClick={() => openCaseFromApproved(selected)} disabled={!selected.caseId}>
                    Ügy megnyitása
                  </button>
                )}
              </div>

              <div style={{ marginTop: 10, opacity: 0.65, fontSize: 12 }}>
                Jóváhagyás után az Ügyek appban megjelenik az új ügy (iktatószámmal).
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
