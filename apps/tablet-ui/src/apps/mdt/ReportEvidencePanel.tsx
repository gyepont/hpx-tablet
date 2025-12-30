import { useEffect, useMemo, useState } from "react";

type EvidenceStatus = "NYITOTT" | "SEALED";

type EvidenceEventAction =
  | "Létrehozva"
  | "Mentve"
  | "Átadva"
  | "Lepecsételve"
  | "Ügy linkelve";

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

  const [items, setItems] = useState<EvidenceItem[]>(() => {
    const raw = safeParseJson<unknown>(localStorage.getItem(EVIDENCE_KEY), []);
    return normalizeEvidenceList(raw);
  });

  const [q, setQ] = useState<string>("");

  useEffect(() => {
    // Magyar komment: EvidenceApp módosításait felvesszük (poll)
    const t = window.setInterval(() => {
      const raw = safeParseJson<unknown>(localStorage.getItem(EVIDENCE_KEY), []);
      setItems(normalizeEvidenceList(raw));
    }, 1200);
    return () => window.clearInterval(t);
  }, []);

  const linked = useMemo(() => items.filter((e) => (e.reportId ?? "") === reportId), [items, reportId]);

  const results = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return items.slice(0, 12);

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
      .slice(0, 18);
  }, [items, q]);

  function writeAll(next: EvidenceItem[]): void {
    setItems(next);
    persistEvidence(next);
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

      return pushEvent(updated, "Mentve", actorName, `Jelentéshez rendelve: ${reportId}`);
    });

    writeAll(next);
    notify("MDT • Bizonyítékok", "Bizonyíték hozzárendelve a jelentéshez.", "success");
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

      return pushEvent(updated, "Mentve", actorName, `Leválasztva a jelentésről: ${reportId}`);
    });

    writeAll(next);
    notify("MDT • Bizonyítékok", "Bizonyíték leválasztva.", "info");
  }

  function openEvidence(evidenceId: string): void {
    try {
      localStorage.setItem(OPEN_EVIDENCE_KEY, JSON.stringify(evidenceId));
    } catch {
      // no-op
    }
    notify("Bizonyítékok", "Nyisd meg a Bizonyítékok appot (rá fog állni).", "info");
  }

  const caseTitle = (reportTitle && reportTitle.trim()) ? reportTitle.trim() : `Jelentés • ${reportId}`;

  return (
    <div style={{ border: "1px solid rgba(255,255,255,0.10)", padding: 10, marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 900 }}>Bizonyítékok</div>
          <div style={{ opacity: 0.7, fontSize: 12 }}>
            Jelentés ID: <b>{reportId}</b> • Kapcsolt: <b>{linked.length}</b>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="hpx-btn" onClick={() => requestCaseFromReport(reportId, caseTitle, actorName)}>
            Ügy javaslat
          </button>
        </div>
      </div>

      <div style={{ marginTop: 10 }}>
        {linked.length === 0 ? (
          <div style={{ opacity: 0.7, fontSize: 13 }}>Nincs még kapcsolt bizonyíték.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {linked.slice(0, 10).map((e) => {
              const sealed = String(e.status ?? "NYITOTT") === "SEALED";
              return (
                <div key={e.id} style={{ border: "1px solid rgba(255,255,255,0.10)", padding: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 900 }}>{e.label}</div>
                    <div style={{ opacity: 0.7, fontSize: 12 }}>
                      {String(e.type ?? "—")} • {String(e.status ?? "—")}
                    </div>
                  </div>

                  <div style={{ opacity: 0.75, fontSize: 12, marginTop: 6 }}>
                    ID: {e.id} • Birtokos: <b>{e.holder ?? "—"}</b>
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
                    <button className="hpx-btn" onClick={() => openEvidence(e.id)}>Megnyitás</button>
                    <button className="hpx-btn" onClick={() => unlinkEvidence(e.id)} disabled={sealed} style={{ opacity: sealed ? 0.55 : 1 }}>
                      Leválasztás
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ marginTop: 12, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 10 }}>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>Hozzárendelés</div>

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

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10, maxHeight: 220, overflow: "auto" }}>
          {results.map((e) => {
            const isLinked = (e.reportId ?? "") === reportId;
            const sealed = String(e.status ?? "NYITOTT") === "SEALED";

            return (
              <div key={e.id} style={{ border: "1px solid rgba(255,255,255,0.10)", padding: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 900 }}>{e.label}</div>
                  <div style={{ opacity: 0.7, fontSize: 12 }}>
                    {String(e.type ?? "—")} • {String(e.status ?? "—")}
                  </div>
                </div>

                <div style={{ opacity: 0.75, fontSize: 12, marginTop: 6 }}>
                  ID: {e.id} • Jelentés: <b>{e.reportId ?? "—"}</b>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
                  <button className="hpx-btn hpx-btnAccent" onClick={() => linkEvidence(e.id)} disabled={isLinked} style={{ opacity: isLinked ? 0.55 : 1 }}>
                    Hozzárendelés
                  </button>
                  <button className="hpx-btn" onClick={() => openEvidence(e.id)}>Megnyitás</button>
                  <button className="hpx-btn" onClick={() => unlinkEvidence(e.id)} disabled={!isLinked || sealed} style={{ opacity: (!isLinked || sealed) ? 0.55 : 1 }}>
                    Leválasztás
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 10, opacity: 0.65, fontSize: 12 }}>
          Audit csak műveleteknél íródik (nem gépelésre).
        </div>
      </div>
    </div>
  );
}
