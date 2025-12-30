import type { CaseItem, CasePriority, CaseStatus } from "./types";

const CASE_SEQ_KEY = "hpx:cases:seq:v1";

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function nextCaseNumber(prefix = "HPX"): string {
  const year = new Date().getFullYear();
  const seqKey = `${CASE_SEQ_KEY}:${year}`;
  let next = 1;

  try {
    const raw = localStorage.getItem(seqKey);
    const current = raw ? Number(raw) : 0;
    next = Number.isFinite(current) ? current + 1 : 1;
    localStorage.setItem(seqKey, String(next));
  } catch {
    // no-op
  }

  const padded = String(next).padStart(6, "0");
  return `${prefix}-${year}-${padded}`;
}

export function createCaseDraft(input: {
  title: string;
  description?: string;
  status?: CaseStatus;
  priority?: CasePriority;
  location?: string;
  tags?: string[];
  linkedReportIds?: string[];
  linkedEvidenceIds?: string[];
  linkedBoloIds?: string[];
}): CaseItem {
  const createdAt = nowIso();
  return {
    id: makeId("case"),
    caseNumber: nextCaseNumber("HPX"),
    title: input.title.trim(),
    description: (input.description ?? "").trim(),
    status: input.status ?? "Nyitott",
    priority: input.priority ?? "Közepes",
    location: (input.location ?? "—").trim(),
    tags: input.tags ?? [],
    linkedReportIds: input.linkedReportIds ?? [],
    linkedEvidenceIds: input.linkedEvidenceIds ?? [],
    linkedBoloIds: input.linkedBoloIds ?? [],
    createdAt,
    updatedAt: createdAt,
  };
}

export function touchCase(c: CaseItem): CaseItem {
  return { ...c, updatedAt: nowIso() };
}
