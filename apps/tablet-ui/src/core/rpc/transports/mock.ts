import type { RpcRequestOptions, RpcTransport } from "../transport";
import type {
  BankSummary,
  MdtBolo,
  MdtBoloPriority,
  MdtBoloStatus,
  MdtBoloType,
  MdtBoloTimelineItem,
  MdtCallStatus,
  MdtDispatchCall,
  MdtInvolvedRole,
  MdtOfficer,
  MdtPerson,
  MdtReport,
  MdtReportInvolved,
  MdtReportTimelineItem,
  MdtReportType,
  MdtUnit,
  MdtUnitStatus,
  MdtVehicle
} from "../../mdt/types";

let mockDuty = true;
const MAX_SQUAD_MEMBERS = 4;

let reportSeq = 0;

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function makeReportId(): string {
  reportSeq += 1;
  return `HPX-R-${String(reportSeq).padStart(6, "0")}`;
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function makeSummaryFromHtml(html: string): string {
  const t = stripHtml(html);
  if (!t) return "";
  return t.length > 160 ? t.slice(0, 160) + "…" : t;
}

function toHtmlFromPlain(text: string): string {
  const safe = String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<p>${safe.replace(/\n/g, "<br/>")}</p>`;
}

function normalizeTagList(tags: unknown, tagCatalog: string[]): string[] {
  const arr = Array.isArray(tags) ? tags : [];
  const cleaned = arr.map((t) => String(t ?? "").trim()).filter(Boolean);
  return Array.from(new Set(cleaned.filter((t) => tagCatalog.includes(t)))).slice(0, 30);
}

function normalizeVehicles(list: unknown): string[] {
  const arr = Array.isArray(list) ? list : [];
  const cleaned = arr.map((x) => String(x ?? "").trim().toUpperCase()).filter(Boolean);
  return Array.from(new Set(cleaned)).slice(0, 30);
}

function normalizePeople(list: unknown): number[] {
  const arr = Array.isArray(list) ? list : [];
  const cleaned = arr.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0);
  return Array.from(new Set(cleaned)).slice(0, 30);
}

function normalizeReportIds(list: unknown): string[] {
  const arr = Array.isArray(list) ? list : [];
  const cleaned = arr.map((x) => String(x ?? "").trim()).filter(Boolean);
  return Array.from(new Set(cleaned)).slice(0, 30);
}

function normalizeInvolved(list: unknown): MdtReportInvolved[] {
  const arr = Array.isArray(list) ? list : [];
  const mapped: MdtReportInvolved[] = [];

  for (const x of arr) {
    const cid = Number((x as any)?.cid ?? -1);
    const name = String((x as any)?.name ?? "").trim();
    const roleRaw = String((x as any)?.role ?? "Egyéb");

    if (!Number.isFinite(cid) || cid <= 0) continue;
    if (!name) continue;

    const role: MdtInvolvedRole =
      roleRaw === "Gyanúsított" || roleRaw === "Tanú" || roleRaw === "Áldozat" || roleRaw === "Egyéb"
        ? (roleRaw as MdtInvolvedRole)
        : "Egyéb";

    mapped.push({ cid, name, role });
  }

  const uniq = new Map<number, MdtReportInvolved>();
  for (const i of mapped) uniq.set(i.cid, i);
  return Array.from(uniq.values());
}

function reportTimeline(cid: number, name: string, action: MdtReportTimelineItem["action"], changes?: string | null): MdtReportTimelineItem {
  return { id: makeId(), ts: nowIso(), cid, name, action, changes: changes ?? null };
}

function boloTimeline(actorCid: number, actorName: string, action: MdtBoloTimelineItem["action"], note?: string | null): MdtBoloTimelineItem {
  return { id: makeId(), ts: nowIso(), cid: actorCid, name: actorName, action, note: note ?? null };
}

// ===== Mock data =====
let tagCatalog: string[] = ["Igazoltatás", "Közlekedés", "Fegyver", "Drog", "Erőszak", "Kiemelt", "Tanú", "BOLO"];

let persons: MdtPerson[] = [
  { cid: 1001, name: "Kovács Ádám", dob: "1994-02-11", phone: "555-0101", job: "Civil", flags: ["Kiemelt"] },
  { cid: 1002, name: "Nagy Gábor", dob: "1988-07-30", phone: "555-0202", job: "Sofőr", flags: [] },
  { cid: 1003, name: "Szabó Lili", dob: "2001-10-04", phone: "555-0303", job: "Civil", flags: ["Tanú"] },
];

let vehiclesDb: MdtVehicle[] = [
  { plate: "ABC123", model: "Sultan", color: "Fekete", ownerCid: 1002, ownerName: "Nagy Gábor", flags: ["Közlekedés"], notes: "" },
  { plate: "PD-01", model: "Police Cruiser", color: "Fehér", ownerCid: null, ownerName: "Rendőrség", flags: [], notes: "Szolgálati jármű." },
  { plate: "LUX777", model: "Schafter", color: "Ezüst", ownerCid: 1001, ownerName: "Kovács Ádám", flags: ["Kiemelt"], notes: "" },
];

let officers: MdtOfficer[] = [
  { cid: 1, name: "Gyula", onDuty: true, callsign: null, unitId: null },
  { cid: 2, name: "Kovács Ádám", onDuty: true, callsign: null, unitId: null },
  { cid: 3, name: "Nagy Gábor", onDuty: true, callsign: null, unitId: null },
];

let units: MdtUnit[] = [];

let calls: MdtDispatchCall[] = [
  {
    id: makeId(),
    code: "10-38",
    title: "Gyanús jármű",
    location: "Vinewood Blvd",
    ts: nowIso(),
    origin: { x: 0, y: 0, z: 0 },
    status: "Új",
    assignedUnitId: null,
    timeline: [{ id: makeId(), ts: nowIso(), cid: 0, name: "DISPATCH", action: "Riasztás beérkezett", note: null }],
    reportSummary: null,
    reportId: null,
  },
];

let reports: MdtReport[] = [];

let bolos: MdtBolo[] = [
  {
    id: makeId(),
    type: "Jármű",
    priority: "Magas",
    status: "Aktív",
    title: "Keresett jármű",
    description: "Agresszív vezetés. Ha látod, állítsd meg és jelentsd.",
    tags: ["BOLO", "Közlekedés"],
    people: [],
    vehicles: ["ABC123"],
    reportIds: [],
    expiresAt: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    createdByCid: 0,
    createdByName: "DISPATCH",
    timeline: [boloTimeline(0, "DISPATCH", "Létrehozva", "Automatikus")],
  },
];

function findPerson(cid: number): MdtPerson | undefined {
  return persons.find((p) => p.cid === cid);
}

function findVehicle(plate: string): MdtVehicle | undefined {
  const p = plate.trim().toUpperCase();
  return vehiclesDb.find((v) => v.plate.toUpperCase() === p);
}

function findReport(id: string): MdtReport | undefined {
  return reports.find((r) => r.id === id);
}

function findBolo(id: string): MdtBolo | undefined {
  return bolos.find((b) => b.id === id);
}

function diffReport(oldR: MdtReport, next: MdtReport): string {
  const changes: string[] = [];

  if (oldR.tags.join("|") !== next.tags.join("|")) changes.push("tagek");
  if (oldR.involved.length !== next.involved.length) changes.push("érintettek");
  if (oldR.vehicles.join("|") !== next.vehicles.join("|")) changes.push("járművek");

  if (oldR.fullText !== next.fullText) {
    const a = oldR.fullText.length;
    const b = next.fullText.length;
    changes.push(`tartalom (${a}→${b} karakter)`);
  }

  return changes.length ? changes.join(", ") : "—";
}

export function createMockTransport(): RpcTransport {
  return {
    kind: "mock",
    request: async (event: string, data: unknown, _options?: RpcRequestOptions) => {
      const ts = nowIso();

      switch (event) {
        case "tablet:ping": {
          const p = (data ?? {}) as { message?: string };
          return { ok: true, echoed: p.message ?? "", ts, transport: "mock" } as const;
        }

        case "tablet:getState":
          return { ok: true, ts, transport: "mock" } as const;

        case "tablet:getGameTime": {
          const d = new Date();
          return { ok: true, hours: d.getHours(), minutes: d.getMinutes(), transport: "mock" } as const;
        }

        case "tablet:getPlayerContext":
          return {
            ok: true,
            context: {
              serverId: 1,
              name: "Gyula",
              role: "police",
              jobLabel: "Rendőrség",
              callsign: "A-01",
              duty: mockDuty,
              transport: "mock",
              jobName: "police",
              jobGrade: 1,
            },
          } as const;

        case "tablet:setDuty": {
          const p = (data ?? {}) as { duty?: boolean };
          mockDuty = !!p.duty;
          return { ok: true, duty: mockDuty } as const;
        }

        case "bank:getSummary": {
          const summary: BankSummary = { cash: 2500, bank: 125000, iban: "HU00-TEST-0001" };
          return { ok: true, summary, transport: "mock" } as const;
        }

        case "mdt:getTagCatalog":
          return { ok: true, tags: tagCatalog, transport: "mock" } as const;

        case "mdt:setTagCatalog": {
          const p = (data ?? {}) as { tags?: string[] };
          const next = Array.isArray(p.tags) ? p.tags.map((t) => String(t).trim()).filter(Boolean) : [];
          tagCatalog = Array.from(new Set(next)).slice(0, 80);
          return { ok: true, tags: tagCatalog, transport: "mock" } as const;
        }

        case "mdt:getRoster":
          return { ok: true, officers, transport: "mock" } as const;

        case "mdt:getUnits":
          return { ok: true, units, transport: "mock" } as const;

        case "mdt:requestUnit": {
          const p = (data ?? {}) as { callsign?: string; label?: string };
          const callsign = String(p.callsign ?? "").trim().toUpperCase();
          if (!callsign) throw new Error("callsign required");
          if (units.some((u) => u.callsign.toUpperCase() === callsign)) throw new Error("CALLSIGN_FOGLALT");

          const unit: MdtUnit = { id: makeId(), callsign, label: p.label?.trim() || `${callsign} / Egység`, members: [], status: "Elérhető", updatedAt: nowIso() };
          units = [unit, ...units];
          return { ok: true, unit, transport: "mock" } as const;
        }

        case "mdt:addUnitMember": {
          const p = (data ?? {}) as { unitId?: string; cid?: number };
          const unitId = String(p.unitId ?? "");
          const cid = Number(p.cid ?? -1);

          const unit = units.find((u) => u.id === unitId);
          const officer = officers.find((o) => o.cid === cid);
          if (!unit || !officer) throw new Error("unit/officer not found");
          if (unit.members.length >= MAX_SQUAD_MEMBERS) throw new Error("SQUAD_FULL");

          if (officer.unitId) {
            units = units.map((u) => (u.id === officer.unitId ? { ...u, members: u.members.filter((m) => m !== officer.cid), updatedAt: nowIso() } : u));
          }

          officers = officers.map((o) => (o.cid === cid ? { ...o, unitId: unit.id } : o));
          units = units.map((u) => (u.id === unit.id ? { ...u, members: Array.from(new Set([cid, ...u.members])), updatedAt: nowIso() } : u));

          return { ok: true, unit: units.find((u) => u.id === unit.id)!, transport: "mock" } as const;
        }

        case "mdt:setUnitStatus": {
          const p = (data ?? {}) as { unitId?: string; status?: MdtUnitStatus };
          const unitId = String(p.unitId ?? "");
          const unit = units.find((u) => u.id === unitId);
          if (!unit) throw new Error("unit not found");

          const status: MdtUnitStatus = p.status === "Nem elérhető" ? "Nem elérhető" : "Elérhető";
          units = units.map((u) => (u.id === unitId ? { ...u, status, updatedAt: nowIso() } : u));
          return { ok: true, unit: units.find((u) => u.id === unitId)!, transport: "mock" } as const;
        }

        case "mdt:getDispatchFeed": {
          const p = (data ?? {}) as { limit?: number };
          return { ok: true, calls: calls.slice(0, p.limit ?? 80), transport: "mock" } as const;
        }

        case "mdt:testDispatch": {
          const p = (data ?? {}) as any;
          const call: MdtDispatchCall = {
            id: makeId(),
            code: String(p.code ?? "10-38"),
            title: String(p.title ?? "Teszt riasztás"),
            location: String(p.location ?? "Vinewood Blvd"),
            ts: nowIso(),
            origin: { x: 0, y: 0, z: 0 },
            status: "Új",
            assignedUnitId: null,
            timeline: [{ id: makeId(), ts: nowIso(), cid: 0, name: "DISPATCH", action: "Riasztás beérkezett", note: null }],
            reportSummary: null,
            reportId: null,
          };
          calls = [call, ...calls].slice(0, 120);
          return { ok: true } as const;
        }

        case "mdt:acceptCall": {
          const p = (data ?? {}) as any;
          const callId = String(p.callId ?? "");
          const unitId = String(p.unitId ?? "");
          const actorCid = Number(p.actorCid ?? 0);
          const actorName = String(p.actorName ?? "—");

          const call = calls.find((c) => c.id === callId);
          const unit = units.find((u) => u.id === unitId);
          if (!call || !unit) throw new Error("call/unit not found");
          if (call.assignedUnitId) throw new Error("CALL_ALREADY_ACCEPTED");

          const updated: MdtDispatchCall = {
            ...call,
            assignedUnitId: unit.id,
            status: "Elfogadva",
            timeline: [{ id: makeId(), ts: nowIso(), cid: actorCid, name: actorName, action: "Elfogadta a hívást", note: unit.callsign }, ...call.timeline],
          };

          calls = calls.map((c) => (c.id === callId ? updated : c));
          return { ok: true, call: updated, transport: "mock" } as const;
        }

        case "mdt:updateCallStatus": {
          const p = (data ?? {}) as any;
          const callId = String(p.callId ?? "");
          const status = p.status as MdtCallStatus;
          const actorCid = Number(p.actorCid ?? 0);
          const actorName = String(p.actorName ?? "—");
          const note = p.note ? String(p.note) : null;

          const call = calls.find((c) => c.id === callId);
          if (!call) throw new Error("call not found");
          if (call.status === "Lezárva") throw new Error("CALL_ALREADY_CLOSED");

          const updated: MdtDispatchCall = {
            ...call,
            status,
            timeline: [{ id: makeId(), ts: nowIso(), cid: actorCid, name: actorName, action: `Státusz: ${status}`, note }, ...call.timeline],
          };

          calls = calls.map((c) => (c.id === callId ? updated : c));
          return { ok: true, call: updated, transport: "mock" } as const;
        }

        case "mdt:addCallNote": {
          const p = (data ?? {}) as any;
          const callId = String(p.callId ?? "");
          const actorCid = Number(p.actorCid ?? 0);
          const actorName = String(p.actorName ?? "—");
          const note = String(p.note ?? "").trim();

          const call = calls.find((c) => c.id === callId);
          if (!call) throw new Error("call not found");
          if (call.status === "Lezárva") throw new Error("CALL_ALREADY_CLOSED");

          const updated: MdtDispatchCall = {
            ...call,
            timeline: [{ id: makeId(), ts: nowIso(), cid: actorCid, name: actorName, action: "Megjegyzés", note }, ...call.timeline],
          };

          calls = calls.map((c) => (c.id === callId ? updated : c));
          return { ok: true, call: updated, transport: "mock" } as const;
        }

        case "mdt:closeCall": {
          const p = (data ?? {}) as any;
          const callId = String(p.callId ?? "");
          const actorCid = Number(p.actorCid ?? 0);
          const actorName = String(p.actorName ?? "—");
          const shortText = String(p.report ?? "").trim();

          const call = calls.find((c) => c.id === callId);
          if (!call) throw new Error("call not found");
          if (call.status === "Lezárva") throw new Error("CALL_ALREADY_CLOSED");

          const fullText = toHtmlFromPlain(shortText);
          const summary = makeSummaryFromHtml(fullText);

          const reportId = makeReportId();
          const createdAt = nowIso();

          const report: MdtReport = {
            id: reportId,
            type: "Dispatch",
            tags: normalizeTagList(["Dispatch"], tagCatalog),
            involved: [],
            vehicles: [],
            status: "DRAFT",
            submittedAt: createdAt,
            createdAt,
            updatedAt: createdAt,
            authorCid: actorCid,
            authorName: actorName,
            lastEditorCid: actorCid,
            lastEditorName: actorName,
            title: `${call.code} • ${call.title}`,
            location: call.location,
            summary,
            fullText,
            timeline: [
              reportTimeline(actorCid, actorName, "Létrehozva", "Dispatch lezárás"),
              reportTimeline(actorCid, actorName, "Leadva", "Lezáráskor automatikus leadás"),
            ],
          };

          reports = [report, ...reports].slice(0, 600);

          const updated: MdtDispatchCall = { ...call, status: "Lezárva", reportSummary: summary, reportId: report.id };
          calls = calls.map((c) => (c.id === callId ? updated : c));
          return { ok: true, call: updated, transport: "mock" } as const;
        }

        case "mdt:createReport": {
          const p = (data ?? {}) as any;
          const type: MdtReportType = p.type ?? "Egyéb";

          const title = String(p.title ?? "").trim();
          const location = String(p.location ?? "—").trim();
          if (!title) throw new Error("TITLE_REQUIRED");

          const actorCid = Number(p.actorCid ?? 0);
          const actorName = String(p.actorName ?? "—");

          const fullText = String(p.fullText ?? "<p></p>");
          const summary = makeSummaryFromHtml(fullText);

          const createdAt = nowIso();
          const reportId = makeReportId();

          const report: MdtReport = {
            id: reportId,
            type,
            tags: normalizeTagList(p.tags, tagCatalog),
            involved: normalizeInvolved(p.involved ?? []),
            vehicles: normalizeVehicles(p.vehicles ?? []),
            status: "DRAFT",
            submittedAt: null,
            createdAt,
            updatedAt: createdAt,
            authorCid: actorCid,
            authorName: actorName,
            lastEditorCid: actorCid,
            lastEditorName: actorName,
            title,
            location,
            summary,
            fullText,
            timeline: [reportTimeline(actorCid, actorName, "Létrehozva", "Új jelentés")],
          };

          reports = [report, ...reports].slice(0, 600);
          return { ok: true, report, transport: "mock" } as const;
        }

        case "mdt:getReports": {
          const p = (data ?? {}) as any;
          const q = String(p.query ?? "").trim().toLowerCase();
          const tag = String(p.tag ?? "").trim();
          const type = p.type ?? "ALL";
          const limit = Number(p.limit ?? 200);

          let filtered = reports;
          if (type !== "ALL") filtered = filtered.filter((r) => r.type === type);
          if (tag) filtered = filtered.filter((r) => r.tags.includes(tag));

          if (q) {
            const qUpper = q.toUpperCase();
            filtered = filtered.filter((r) =>
              r.id.toLowerCase().includes(q) ||
              r.title.toLowerCase().includes(q) ||
              r.location.toLowerCase().includes(q) ||
              r.authorName.toLowerCase().includes(q) ||
              stripHtml(r.fullText).toLowerCase().includes(q) ||
              r.involved.some((i) => String(i.cid).includes(q) || i.name.toLowerCase().includes(q)) ||
              r.vehicles.some((pl) => pl.toUpperCase().includes(qUpper))
            );
          }

          return { ok: true, reports: filtered.slice(0, limit), transport: "mock" } as const;
        }

        case "mdt:getReport": {
          const p = (data ?? {}) as any;
          const r = findReport(String(p.reportId ?? ""));
          if (!r) throw new Error("REPORT_NOT_FOUND");
          return { ok: true, report: r, transport: "mock" } as const;
        }

        case "mdt:updateReport": {
          const p = (data ?? {}) as any;
          const r = findReport(String(p.reportId ?? ""));
          if (!r) throw new Error("REPORT_NOT_FOUND");
          if (r.status === "SUBMITTED") throw new Error("REPORT_LOCKED");

          const actorCid = Number(p.actorCid ?? 0);
          const actorName = String(p.actorName ?? "—");

          const next: MdtReport = {
            ...r,
            tags: p.tags ? normalizeTagList(p.tags, tagCatalog) : r.tags,
            involved: p.involved ? normalizeInvolved(p.involved ?? []) : r.involved,
            vehicles: p.vehicles ? normalizeVehicles(p.vehicles ?? []) : r.vehicles,
            fullText: String(p.fullText ?? r.fullText),
            summary: makeSummaryFromHtml(String(p.fullText ?? r.fullText)),
            updatedAt: nowIso(),
            lastEditorCid: actorCid,
            lastEditorName: actorName,
          };

          const changes = diffReport(r, next);
          next.timeline = [reportTimeline(actorCid, actorName, "Mentve", changes), ...r.timeline].slice(0, 120);

          reports = reports.map((x) => (x.id === next.id ? next : x));
          return { ok: true, report: next, transport: "mock" } as const;
        }

        case "mdt:submitReport": {
          const p = (data ?? {}) as any;
          const r = findReport(String(p.reportId ?? ""));
          if (!r) throw new Error("REPORT_NOT_FOUND");
          if (r.status === "SUBMITTED") return { ok: true, report: r, transport: "mock" } as const;

          const actorCid = Number(p.actorCid ?? 0);
          const actorName = String(p.actorName ?? "—");
          const ts2 = nowIso();

          const next: MdtReport = {
            ...r,
            status: "SUBMITTED",
            submittedAt: ts2,
            updatedAt: ts2,
            lastEditorCid: actorCid,
            lastEditorName: actorName,
            timeline: [reportTimeline(actorCid, actorName, "Leadva", "Jelentés leadva (lezárva)"), ...r.timeline].slice(0, 120),
          };

          reports = reports.map((x) => (x.id === next.id ? next : x));
          return { ok: true, report: next, transport: "mock" } as const;
        }

        case "mdt:searchPerson": {
          const p = (data ?? {}) as any;
          const q = String(p.query ?? "").trim().toLowerCase();
          const limit = Number(p.limit ?? 25);
          const filtered = q ? persons.filter((x) => x.name.toLowerCase().includes(q) || String(x.cid).includes(q)) : persons;
          return { ok: true, persons: filtered.slice(0, limit), transport: "mock" } as const;
        }

        case "mdt:getPerson": {
          const p = (data ?? {}) as any;
          const person = findPerson(Number(p.cid ?? -1));
          if (!person) throw new Error("PERSON_NOT_FOUND");
          return { ok: true, person, transport: "mock" } as const;
        }

        case "mdt:searchVehicle": {
          const p = (data ?? {}) as any;
          const q = String(p.query ?? "").trim().toLowerCase();
          const limit = Number(p.limit ?? 25);
          const filtered = q
            ? vehiclesDb.filter((v) => v.plate.toLowerCase().includes(q) || v.model.toLowerCase().includes(q) || (v.ownerName ?? "").toLowerCase().includes(q))
            : vehiclesDb;
          return { ok: true, vehicles: filtered.slice(0, limit), transport: "mock" } as const;
        }

        case "mdt:getVehicle": {
          const p = (data ?? {}) as any;
          const v = findVehicle(String(p.plate ?? ""));
          if (!v) throw new Error("VEHICLE_NOT_FOUND");
          return { ok: true, vehicle: v, transport: "mock" } as const;
        }

        // ===== BOLO =====
        case "mdt:getBolos": {
          const p = (data ?? {}) as any;
          const q = String(p.query ?? "").trim().toLowerCase();
          const limit = Number(p.limit ?? 200);

          const status = (p.status ?? "ALL") as MdtBoloStatus | "ALL";
          const type = (p.type ?? "ALL") as MdtBoloType | "ALL";
          const priority = (p.priority ?? "ALL") as MdtBoloPriority | "ALL";

          let filtered = bolos;

          if (status !== "ALL") filtered = filtered.filter((b) => b.status === status);
          if (type !== "ALL") filtered = filtered.filter((b) => b.type === type);
          if (priority !== "ALL") filtered = filtered.filter((b) => b.priority === priority);

          if (q) {
            const qUpper = q.toUpperCase();
            filtered = filtered.filter((b) =>
              b.title.toLowerCase().includes(q) ||
              b.description.toLowerCase().includes(q) ||
              b.people.some((cid: number) => String(cid).includes(q)) ||
              b.vehicles.some((pl: string) => pl.toUpperCase().includes(qUpper)) ||
              b.reportIds.some((rid: string) => rid.toLowerCase().includes(q))
            );
          }

          return { ok: true, bolos: filtered.slice(0, limit), transport: "mock" } as const;
        }

        case "mdt:getBolo": {
          const p = (data ?? {}) as any;
          const b = findBolo(String(p.boloId ?? ""));
          if (!b) throw new Error("BOLO_NOT_FOUND");
          return { ok: true, bolo: b, transport: "mock" } as const;
        }

        case "mdt:createBolo": {
          const p = (data ?? {}) as any;

          const type: MdtBoloType = p.type ?? "Általános";
          const priority: MdtBoloPriority = p.priority ?? "Közepes";

          const title = String(p.title ?? "").trim();
          const description = String(p.description ?? "").trim();
          if (!title || !description) throw new Error("BOLO_FIELDS_REQUIRED");

          const expiresInMinutes = p.expiresInMinutes === null || p.expiresInMinutes === undefined ? null : Number(p.expiresInMinutes);
          const expiresAt =
            expiresInMinutes && Number.isFinite(expiresInMinutes) && expiresInMinutes > 0
              ? new Date(Date.now() + expiresInMinutes * 60_000).toISOString()
              : null;

          const actorCid = Number(p.actorCid ?? 0);
          const actorName = String(p.actorName ?? "—");

          const b: MdtBolo = {
            id: makeId(),
            type,
            priority,
            status: "Aktív",
            title,
            description,
            tags: normalizeTagList(p.tags, tagCatalog),
            people: normalizePeople(p.people),
            vehicles: normalizeVehicles(p.vehicles ?? []),
            reportIds: normalizeReportIds(p.reportIds),
            expiresAt,
            createdAt: nowIso(),
            updatedAt: nowIso(),
            createdByCid: actorCid,
            createdByName: actorName,
            timeline: [boloTimeline(actorCid, actorName, "Létrehozva", null)],
          };

          bolos = [b, ...bolos].slice(0, 300);
          return { ok: true, bolo: b, transport: "mock" } as const;
        }

        case "mdt:updateBolo": {
          const p = (data ?? {}) as any;
          const id = String(p.boloId ?? "");
          const b = findBolo(id);
          if (!b) throw new Error("BOLO_NOT_FOUND");

          const actorCid = Number(p.actorCid ?? 0);
          const actorName = String(p.actorName ?? "—");
          const nextStatus = (p.status ?? b.status) as MdtBoloStatus;

          const action: MdtBoloTimelineItem["action"] =
            nextStatus === "Lezárva" ? "Lezárva" :
            nextStatus === "Felfüggesztve" ? "Felfüggesztve" :
            b.status === "Felfüggesztve" && nextStatus === "Aktív" ? "Újraaktiválva" :
            "Frissítve";

          const updated: MdtBolo = {
            ...b,
            status: nextStatus,
            updatedAt: nowIso(),
            timeline: [boloTimeline(actorCid, actorName, action, null), ...b.timeline].slice(0, 80),
          };

          bolos = bolos.map((x) => (x.id === id ? updated : x));
          return { ok: true, bolo: updated, transport: "mock" } as const;
        }

        case "mdt:boloSighting": {
          const p = (data ?? {}) as any;
          const id = String(p.boloId ?? "");
          const b = findBolo(id);
          if (!b) throw new Error("BOLO_NOT_FOUND");

          const actorCid = Number(p.actorCid ?? 0);
          const actorName = String(p.actorName ?? "—");
          const note = p.note ? String(p.note).trim() : null;

          const updated: MdtBolo = {
            ...b,
            updatedAt: nowIso(),
            timeline: [boloTimeline(actorCid, actorName, "Láttam", note), ...b.timeline].slice(0, 80),
          };

          bolos = bolos.map((x) => (x.id === id ? updated : x));
          return { ok: true, bolo: updated, transport: "mock" } as const;
        }

        case "mdt:setWaypoint":
          return { ok: true } as const;

        case "tablet:close":
          return { ok: true } as const;

        default:
          throw new Error(`Mock RPC: ismeretlen event "${event}"`);
      }
    },
  };
}
