// Types
export type EvidenceStatus = "NYITOTT" | "SEALED";

export type EvidenceEventAction =
  | "Létrehozva"
  | "Mentve"
  | "Átadva"
  | "Lepecsételve"
  | "Ügy linkelve"
  | "Jelentéshez rendelve"
  | "Jelentésről leválasztva";

export type EvidenceEvent = {
  id: string;
  ts: string;
  action: EvidenceEventAction;
  by: string;
  holder?: string | null;
  note?: string | null;
};

export type EvidenceItem = {
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

export type CaseRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export type CaseRequest = {
  id: string;
  ts: string;
  reportId: string;
  reportTitle: string;
  note?: string | null;
  createdBy: string;
  status: CaseRequestStatus;
};

// Constants
export const EVIDENCE_KEY = "hpx:evidence:v1";
export const OPEN_EVIDENCE_KEY = "hpx:evidence:openEvidenceId:v1";
export const REQUESTS_KEY = "hpx:cases:requests:v1";

// Utility functions
export function nowIso(): string {
  return new Date().toISOString();
}

export function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function safeParseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function persistEvidence(items: EvidenceItem[]): void {
  try {
    localStorage.setItem(EVIDENCE_KEY, JSON.stringify(items));
  } catch {
    // no-op
  }
}

export function notify(title: string, message: string, level: "info" | "success" | "warning" | "error" = "info") {
  window.postMessage({ type: "hpx:notify", title, message, level }, "*");
}

export function normalizeEvidenceList(raw: unknown): EvidenceItem[] {
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

export function pushEvent(e: EvidenceItem, action: EvidenceEventAction, by: string, note?: string | null): EvidenceItem {
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

export function requestCaseFromReport(reportId: string, reportTitle: string, actorName: string): void {
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

export function openEvidence(evidenceId: string): void {
  try {
    localStorage.setItem(OPEN_EVIDENCE_KEY, JSON.stringify(evidenceId));
  } catch {
    // no-op
  }
  notify("Bizonyítékok", "Nyisd meg a Bizonyítékok appot (rá fog állni).", "info");
}

export function filterEvidenceBySearch(items: EvidenceItem[], query: string): EvidenceItem[] {
  const qq = query.trim().toLowerCase();
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
}
