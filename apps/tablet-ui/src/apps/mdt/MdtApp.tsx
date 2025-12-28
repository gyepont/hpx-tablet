import { useEffect, useMemo, useState } from "react";
import { getRpcTransportKind, rpcCall } from "../../core/rpc/client";
import { usePlayerContext } from "../../core/session/usePlayerContext";
import ReportEditor from "./ReportEditor";

import type {
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
  MdtVehicle,
} from "../../core/mdt/types";

type Tab = "Dispatch" | "Egységek" | "Jelentések" | "Személy" | "Jármű" | "BOLO";

const REPORT_TYPES: MdtReportType[] = ["Igazoltatás", "Intézkedés", "Incidens", "Nyomozás", "Dispatch", "Egyéb"];
const INVOLVED_ROLES: MdtInvolvedRole[] = ["Gyanúsított", "Tanú", "Áldozat", "Egyéb"];

const BOLO_TYPES: MdtBoloType[] = ["Személy", "Jármű", "Általános"];
const BOLO_PRIORITIES: MdtBoloPriority[] = ["Alacsony", "Közepes", "Magas", "Kritikus"];
const BOLO_STATUSES: (MdtBoloStatus | "ALL")[] = ["ALL", "Aktív", "Felfüggesztve", "Lezárva"];

function hhmmss(ts: string): string {
  return ts && ts.length >= 19 ? ts.slice(11, 19) : ts;
}

function fmtDate(ts: string | null | undefined): string {
  if (!ts) return "—";
  try {
    const d = new Date(ts);
    return `${d.toLocaleDateString("hu-HU")} ${d.toLocaleTimeString("hu-HU")}`;
  } catch {
    return ts;
  }
}

function notify(title: string, message: string, level: "info" | "success" | "warning" | "error" = "info") {
  window.postMessage({ type: "hpx:notify", title, message, level }, "*");
}

function plateNorm(s: string): string {
  return s.trim().toUpperCase().replace(/\s+/g, "");
}

function getCallAccent(status: MdtCallStatus): { dot: string; border: string } {
  switch (status) {
    case "Új":
      return { dot: "#ff3b3b", border: "rgba(255,59,59,0.35)" };
    case "Elfogadva":
      return { dot: "#ffd84c", border: "rgba(255,216,76,0.30)" };
    case "Úton":
      return { dot: "#4cc9ff", border: "rgba(76,201,255,0.28)" };
    case "Helyszínen":
      return { dot: "#ff9a4c", border: "rgba(255,154,76,0.30)" };
    case "Lezárva":
      return { dot: "#2fe86e", border: "rgba(47,232,110,0.30)" };
  }
}

function boloPriorityDot(p: MdtBoloPriority): string {
  switch (p) {
    case "Alacsony":
      return "#4cc9ff";
    case "Közepes":
      return "#ffd84c";
    case "Magas":
      return "#ff9a4c";
    case "Kritikus":
      return "#ff3b3b";
  }
}

function parseCsvNumbers(s: string): number[] {
  return s
    .split(",")
    .map((x) => Number(x.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function parseCsvStrings(s: string): string[] {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

export default function MdtApp() {
  const { data: player } = usePlayerContext();
  const transport = getRpcTransportKind();

  const actorCid = player?.serverId ?? 0;
  const actorName = player?.name ?? "—";

  const canManageTags = player?.role === "admin" || transport === "mock";

  const [tab, setTab] = useState<Tab>("Dispatch");

  // ===== Core =====
  const [officers, setOfficers] = useState<MdtOfficer[]>([]);
  const [units, setUnits] = useState<MdtUnit[]>([]);
  const [calls, setCalls] = useState<MdtDispatchCall[]>([]);
  const [loading, setLoading] = useState(false);

  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [dispatchReportDraft, setDispatchReportDraft] = useState<string>("");

  // ===== Reports =====
  const [tagCatalog, setTagCatalog] = useState<string[]>([]);
  const [reportQuery, setReportQuery] = useState<string>("");
  const [reportFilterTag, setReportFilterTag] = useState<string>("");
  const [reportFilterType, setReportFilterType] = useState<MdtReportType | "ALL">("ALL");

  const [reports, setReports] = useState<MdtReport[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [reportDetail, setReportDetail] = useState<MdtReport | null>(null);
  const [reportSaving, setReportSaving] = useState(false);

  const [newOpen, setNewOpen] = useState(false);
  const [newType, setNewType] = useState<MdtReportType>("Igazoltatás");
  const [newTitle, setNewTitle] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newTags, setNewTags] = useState<string[]>([]);

  const [tagInput, setTagInput] = useState("");

  const [addInvolvedCid, setAddInvolvedCid] = useState("");
  const [addInvolvedRole, setAddInvolvedRole] = useState<MdtInvolvedRole>("Egyéb");
  const [addVehiclePlate, setAddVehiclePlate] = useState("");

  // ===== Person =====
  const [personQuery, setPersonQuery] = useState("");
  const [personResults, setPersonResults] = useState<MdtPerson[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<MdtPerson | null>(null);
  const [personLinkedReports, setPersonLinkedReports] = useState<MdtReport[]>([]);

  // ===== Vehicle =====
  const [vehicleQuery, setVehicleQuery] = useState("");
  const [vehicleResults, setVehicleResults] = useState<MdtVehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<MdtVehicle | null>(null);
  const [vehicleLinkedReports, setVehicleLinkedReports] = useState<MdtReport[]>([]);

  // ===== BOLO =====
  const [boloQuery, setBoloQuery] = useState("");
  const [boloFilterStatus, setBoloFilterStatus] = useState<MdtBoloStatus | "ALL">("ALL");
  const [boloFilterType, setBoloFilterType] = useState<MdtBoloType | "ALL">("ALL");
  const [boloFilterPriority, setBoloFilterPriority] = useState<MdtBoloPriority | "ALL">("ALL");

  const [bolos, setBolos] = useState<MdtBolo[]>([]);
  const [selectedBoloId, setSelectedBoloId] = useState<string | null>(null);
  const [selectedBolo, setSelectedBolo] = useState<MdtBolo | null>(null);

  const [boloNewOpen, setBoloNewOpen] = useState(false);
  const [boloNewType, setBoloNewType] = useState<MdtBoloType>("Általános");
  const [boloNewPriority, setBoloNewPriority] = useState<MdtBoloPriority>("Közepes");
  const [boloNewTitle, setBoloNewTitle] = useState("");
  const [boloNewDesc, setBoloNewDesc] = useState("");
  const [boloNewTags, setBoloNewTags] = useState<string[]>([]);
  const [boloNewPeopleCsv, setBoloNewPeopleCsv] = useState("");
  const [boloNewVehiclesCsv, setBoloNewVehiclesCsv] = useState("");
  const [boloNewReportsCsv, setBoloNewReportsCsv] = useState("");
  const [boloNewExpiresMin, setBoloNewExpiresMin] = useState("");
  const [boloSightingNote, setBoloSightingNote] = useState("");

  // ===== Lookups =====
  const callById = useMemo(() => new Map(calls.map((c) => [c.id, c] as const)), [calls]);
  const unitById = useMemo(() => new Map(units.map((u) => [u.id, u] as const)), [units]);
  const officerByCid = useMemo(() => new Map(officers.map((o) => [o.cid, o] as const)), [officers]);

  const selectedCall = selectedCallId ? callById.get(selectedCallId) ?? null : null;
  const selectedUnit = selectedUnitId ? unitById.get(selectedUnitId) ?? null : null;

  const isReportLocked = !!reportDetail && reportDetail.status === "SUBMITTED";

  // ===== Fetch =====
  async function refreshAll(): Promise<void> {
    setLoading(true);
    try {
      const [r1, r2, r3] = await Promise.all([
        rpcCall("mdt:getRoster", {}, { timeoutMs: 2500 }),
        rpcCall("mdt:getUnits", {}, { timeoutMs: 2500 }),
        rpcCall("mdt:getDispatchFeed", { limit: 80 }, { timeoutMs: 2500 }),
      ]);

      setOfficers(r1.officers);
      setUnits(r2.units);
      setCalls(r3.calls);

      if (!selectedUnitId && r2.units.length) setSelectedUnitId(r2.units[0].id);
      if (!selectedCallId && r3.calls.length) setSelectedCallId(r3.calls[0].id);
    } finally {
      setLoading(false);
    }
  }

  async function refreshTagCatalog(): Promise<void> {
    const res = await rpcCall("mdt:getTagCatalog", {}, { timeoutMs: 2500 });
    setTagCatalog(res.tags);
  }

  async function refreshReports(): Promise<void> {
    const res = await rpcCall(
      "mdt:getReports",
      { query: reportQuery.trim() || undefined, limit: 200, tag: reportFilterTag || undefined, type: reportFilterType },
      { timeoutMs: 4000 }
    );
    setReports(res.reports);
  }

  async function openReport(reportId: string): Promise<void> {
    setSelectedReportId(reportId);
    const res = await rpcCall("mdt:getReport", { reportId }, { timeoutMs: 3000 });
    setReportDetail(res.report);
  }

  async function refreshBolos(): Promise<void> {
    const res = await rpcCall(
      "mdt:getBolos",
      { query: boloQuery.trim() || undefined, limit: 200, status: boloFilterStatus, type: boloFilterType, priority: boloFilterPriority },
      { timeoutMs: 4000 }
    );
    setBolos(res.bolos);

    if (!selectedBoloId && res.bolos.length) {
      await openBolo(res.bolos[0].id);
      return;
    }
    if (selectedBoloId && !res.bolos.some((b) => b.id === selectedBoloId)) {
      if (res.bolos.length) await openBolo(res.bolos[0].id);
      else {
        setSelectedBoloId(null);
        setSelectedBolo(null);
      }
    }
  }

  useEffect(() => {
    void refreshAll();
    const t = window.setInterval(() => void refreshAll(), 2500);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tab === "Jelentések" || tab === "Személy" || tab === "Jármű" || tab === "BOLO") {
      void refreshTagCatalog();
      void refreshReports();
    }
    if (tab === "BOLO") void refreshBolos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // ===== Új report: tag toggle (used) =====
  function toggleNewTag(tag: string): void {
    setNewTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  // ===== Units DnD =====
  function onOfficerDragStart(cid: number, e: React.DragEvent) {
    e.dataTransfer.setData("text/plain", `officer:${cid}`);
    e.dataTransfer.effectAllowed = "move";
  }

  function allowDrop(e: React.DragEvent) {
    e.preventDefault();
  }

  async function onUnitDrop(unitId: string, e: React.DragEvent) {
    e.preventDefault();
    const txt = e.dataTransfer.getData("text/plain");
    if (!txt.startsWith("officer:")) return;
    const cid = Number(txt.slice("officer:".length));

    try {
      await rpcCall("mdt:addUnitMember", { unitId, cid }, { timeoutMs: 2500 });
      notify("Egységek", "Járőr hozzárendelve egységhez.", "success");
      await refreshAll();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      notify("Egységek", msg, msg.includes("SQUAD_FULL") ? "warning" : "error");
    }
  }

  async function requestUnit(): Promise<void> {
    const cs = prompt("Add meg a callsign-t:", "A-01") ?? "";
    const callsign = cs.trim().toUpperCase();
    if (!callsign) return;

    try {
      await rpcCall("mdt:requestUnit", { callsign, label: `${callsign} / Egység` }, { timeoutMs: 2500 });
      notify("Egység", `Egység igényelve: ${callsign}`, "success");
      await refreshAll();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      notify("Egység", msg, "warning");
    }
  }

  async function setUnitStatus(unitId: string, status: MdtUnitStatus): Promise<void> {
    await rpcCall("mdt:setUnitStatus", { unitId, status, actorCid, actorName }, { timeoutMs: 2500 });
    await refreshAll();
  }

  // ===== Dispatch =====
  async function acceptCall(callId: string, unitId: string): Promise<void> {
    try {
      await rpcCall("mdt:acceptCall", { callId, unitId, actorCid, actorName }, { timeoutMs: 3000 });
      await refreshAll();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      notify("Dispatch", msg, "warning");
    }
  }

  async function updateCallStatus(callId: string, status: MdtCallStatus): Promise<void> {
    await rpcCall("mdt:updateCallStatus", { callId, status, actorCid, actorName }, { timeoutMs: 3000 });
    await refreshAll();
  }

  async function addNote(callId: string): Promise<void> {
    const note = (prompt("Megjegyzés:", "") ?? "").trim();
    if (!note) return;
    await rpcCall("mdt:addCallNote", { callId, actorCid, actorName, note }, { timeoutMs: 3000 });
    await refreshAll();
  }

  async function closeCall(callId: string): Promise<void> {
    const report = dispatchReportDraft.trim();
    if (!report) {
      notify("Jelentés", "A lezáráshoz írj rövid jelentést.", "warning");
      return;
    }
    const res = await rpcCall("mdt:closeCall", { callId, actorCid, actorName, report }, { timeoutMs: 3000 });
    setDispatchReportDraft("");
    await refreshAll();
    setTab("Jelentések");
    if (res.call.reportId) await openReport(res.call.reportId);
  }

  async function testDispatch(): Promise<void> {
    await rpcCall("mdt:testDispatch", { code: "10-38", title: "Teszt riasztás", location: "Vinewood Blvd" }, { timeoutMs: 2000 });
    await refreshAll();
  }

  async function setWaypoint(call: MdtDispatchCall): Promise<void> {
    if (!call.origin) return;
    await rpcCall("mdt:setWaypoint", { x: call.origin.x, y: call.origin.y, z: call.origin.z ?? 0 }, { timeoutMs: 1500 });
    notify("Útvonal", "Waypoint beállítva.", "success");
  }

  // ===== Reports audit =====
  async function saveReport(): Promise<void> {
    if (!reportDetail) return;
    if (reportDetail.status === "SUBMITTED") {
      notify("Jelentés", "A jelentés már le van adva, nem szerkeszthető.", "warning");
      return;
    }

    setReportSaving(true);
    try {
      const res = await rpcCall(
        "mdt:updateReport",
        { reportId: reportDetail.id, fullText: reportDetail.fullText, tags: reportDetail.tags, involved: reportDetail.involved, vehicles: reportDetail.vehicles, actorCid, actorName },
        { timeoutMs: 5000 }
      );
      setReportDetail(res.report);
      await refreshReports();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      notify("Jelentés", msg, "error");
    } finally {
      setReportSaving(false);
    }
  }

  async function submitReport(): Promise<void> {
    if (!reportDetail) return;
    if (reportDetail.status === "SUBMITTED") return;

    setReportSaving(true);
    try {
      const res = await rpcCall("mdt:submitReport", { reportId: reportDetail.id, actorCid, actorName }, { timeoutMs: 4000 });
      setReportDetail(res.report);
      await refreshReports();
      notify("Jelentés", "Jelentés leadva. Innentől nem módosítható.", "success");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      notify("Jelentés", msg, "error");
    } finally {
      setReportSaving(false);
    }
  }

  function toggleReportTag(tag: string): void {
    if (!reportDetail) return;
    if (reportDetail.status === "SUBMITTED") return;
    setReportDetail({ ...reportDetail, tags: reportDetail.tags.includes(tag) ? reportDetail.tags.filter((t) => t !== tag) : [...reportDetail.tags, tag] });
  }

  function addTagToCatalog(): void {
    const t = tagInput.trim();
    if (!t) return;
    if (tagCatalog.includes(t)) return;
    setTagCatalog((prev) => [...prev, t]);
    setTagInput("");
  }

  function removeTagFromCatalog(tag: string): void {
    setTagCatalog((prev) => prev.filter((t) => t !== tag));
  }

  async function saveTagCatalog(): Promise<void> {
    const res = await rpcCall("mdt:setTagCatalog", { tags: tagCatalog }, { timeoutMs: 3000 });
    setTagCatalog(res.tags);
    await refreshReports();
  }

  async function createReport(payload: { type: MdtReportType; title: string; location: string; tags: string[]; involved: MdtReportInvolved[]; vehicles: string[] }): Promise<void> {
    const res = await rpcCall(
      "mdt:createReport",
      { type: payload.type, title: payload.title, location: payload.location, tags: payload.tags, involved: payload.involved, vehicles: payload.vehicles, fullText: "<p></p>", actorCid, actorName },
      { timeoutMs: 4000 }
    );

    setNewOpen(false);
    setNewTitle("");
    setNewLocation("");
    setNewTags([]);

    await refreshReports();
    await openReport(res.report.id);
  }

  function updateInvolvedRole(cid: number, role: MdtInvolvedRole): void {
    if (!reportDetail) return;
    if (reportDetail.status === "SUBMITTED") return;
    setReportDetail({ ...reportDetail, involved: reportDetail.involved.map((x) => (x.cid === cid ? { ...x, role } : x)) });
  }

  function removeInvolved(cid: number): void {
    if (!reportDetail) return;
    if (reportDetail.status === "SUBMITTED") return;
    setReportDetail({ ...reportDetail, involved: reportDetail.involved.filter((x) => x.cid !== cid) });
  }

  async function addInvolvedFromInput(): Promise<void> {
    if (!reportDetail) return;
    if (reportDetail.status === "SUBMITTED") return;

    const cid = Number(addInvolvedCid.trim());
    if (!Number.isFinite(cid) || cid <= 0) {
      notify("Érintettek", "Hibás CID.", "warning");
      return;
    }
    if (reportDetail.involved.some((x) => x.cid === cid)) {
      setAddInvolvedCid("");
      return;
    }

    let name = `CID ${cid}`;
    try {
      const pr = await rpcCall("mdt:getPerson", { cid }, { timeoutMs: 2500 });
      name = pr.person.name;
    } catch {}

    setReportDetail({ ...reportDetail, involved: [...reportDetail.involved, { cid, name, role: addInvolvedRole }] });
    setAddInvolvedCid("");
  }

  function addVehicleToReport(): void {
    if (!reportDetail) return;
    if (reportDetail.status === "SUBMITTED") return;

    const plate = plateNorm(addVehiclePlate);
    if (!plate) return;
    if (reportDetail.vehicles.includes(plate)) {
      setAddVehiclePlate("");
      return;
    }
    setReportDetail({ ...reportDetail, vehicles: [...reportDetail.vehicles, plate] });
    setAddVehiclePlate("");
  }

  function removeVehicleFromReport(plate: string): void {
    if (!reportDetail) return;
    if (reportDetail.status === "SUBMITTED") return;
    setReportDetail({ ...reportDetail, vehicles: reportDetail.vehicles.filter((p) => p !== plate) });
  }

  // ===== Person =====
  async function searchPerson(): Promise<void> {
    const res = await rpcCall("mdt:searchPerson", { query: personQuery.trim(), limit: 25 }, { timeoutMs: 3000 });
    setPersonResults(res.persons);
  }

  async function openPerson(cid: number): Promise<void> {
    const res = await rpcCall("mdt:getPerson", { cid }, { timeoutMs: 3000 });
    setSelectedPerson(res.person);

    const rr = await rpcCall("mdt:getReports", { query: String(cid), limit: 50, type: "ALL" }, { timeoutMs: 4000 });
    setPersonLinkedReports(rr.reports);
  }

  async function createReportForPerson(): Promise<void> {
    if (!selectedPerson) return;
    const titleDefault = `Igazoltatás • ${selectedPerson.name} (CID ${selectedPerson.cid})`;
    const title = (prompt("Jelentés címe:", titleDefault) ?? "").trim();
    if (!title) return;

    const tags = tagCatalog.includes("Igazoltatás") ? ["Igazoltatás"] : [];
    const involved: MdtReportInvolved[] = [{ cid: selectedPerson.cid, name: selectedPerson.name, role: "Egyéb" }];
    await createReport({ type: "Igazoltatás", title, location: "—", tags, involved, vehicles: [] });
    setTab("Jelentések");
  }

  // ===== Vehicle =====
  async function searchVehicle(): Promise<void> {
    const res = await rpcCall("mdt:searchVehicle", { query: vehicleQuery.trim(), limit: 25 }, { timeoutMs: 3000 });
    setVehicleResults(res.vehicles);
  }

  async function openVehicle(plate: string): Promise<void> {
    const p = plateNorm(plate);
    const res = await rpcCall("mdt:getVehicle", { plate: p }, { timeoutMs: 3000 });
    setSelectedVehicle(res.vehicle);

    const rr = await rpcCall("mdt:getReports", { query: p, limit: 50, type: "ALL" }, { timeoutMs: 4000 });
    setVehicleLinkedReports(rr.reports);
  }

  async function createReportForVehicle(): Promise<void> {
    if (!selectedVehicle) return;
    const plate = plateNorm(selectedVehicle.plate);

    const titleDefault = `Intézkedés • Jármű (${plate})`;
    const title = (prompt("Jelentés címe:", titleDefault) ?? "").trim();
    if (!title) return;

    const tags: string[] = [];
    if (tagCatalog.includes("Közlekedés")) tags.push("Közlekedés");

    await createReport({ type: "Intézkedés", title, location: "—", tags, involved: [], vehicles: [plate] });
    setTab("Jelentések");
  }

  // ===== BOLO =====
  function toggleBoloNewTag(tag: string): void {
    setBoloNewTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  async function openBolo(id: string): Promise<void> {
    setSelectedBoloId(id);
    const res = await rpcCall("mdt:getBolo", { boloId: id }, { timeoutMs: 3000 });
    setSelectedBolo(res.bolo);
  }

  async function createBolo(): Promise<void> {
    const title = boloNewTitle.trim();
    const desc = boloNewDesc.trim();
    if (!title || !desc) {
      notify("BOLO", "Cím és leírás kötelező.", "warning");
      return;
    }

    const expiresRaw = boloNewExpiresMin.trim();
    const expiresNum = expiresRaw ? Number(expiresRaw) : null;
    const expiresInMinutes = expiresNum && Number.isFinite(expiresNum) && expiresNum > 0 ? expiresNum : null;

    const people = parseCsvNumbers(boloNewPeopleCsv);
    const vehicles = parseCsvStrings(boloNewVehiclesCsv).map(plateNorm);
    const reportIds = parseCsvStrings(boloNewReportsCsv);

    const res = await rpcCall(
      "mdt:createBolo",
      { type: boloNewType, priority: boloNewPriority, title, description: desc, tags: boloNewTags, people, vehicles, reportIds, expiresInMinutes, actorCid, actorName },
      { timeoutMs: 4000 }
    );

    setBoloNewOpen(false);
    setBoloNewTitle("");
    setBoloNewDesc("");
    setBoloNewTags([]);
    setBoloNewPeopleCsv("");
    setBoloNewVehiclesCsv("");
    setBoloNewReportsCsv("");
    setBoloNewExpiresMin("");

    await refreshBolos();
    await openBolo(res.bolo.id);
  }

  async function updateBoloStatus(status: MdtBoloStatus): Promise<void> {
    if (!selectedBolo) return;
    const res = await rpcCall("mdt:updateBolo", { boloId: selectedBolo.id, status, actorCid, actorName }, { timeoutMs: 3000 });
    setSelectedBolo(res.bolo);
    await refreshBolos();
  }

  async function markBoloSighting(): Promise<void> {
    if (!selectedBolo) return;
    const res = await rpcCall("mdt:boloSighting", { boloId: selectedBolo.id, note: boloSightingNote.trim() || null, actorCid, actorName }, { timeoutMs: 3000 });
    setSelectedBolo(res.bolo);
    setBoloSightingNote("");
    await refreshBolos();
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 12 }}>
      {/* Left menu */}
      <div style={{ border: "1px solid rgba(255,255,255,0.10)", background: "rgba(0,0,0,0.16)", padding: 10 }}>
        <div style={{ fontWeight: 900, marginBottom: 10 }}>MDT</div>
        {(["Dispatch", "Egységek", "Jelentések", "Személy", "Jármű", "BOLO"] as Tab[]).map((t) => (
          <button
            key={t}
            className={`hpx-btn ${tab === t ? "hpx-btnAccent" : ""}`}
            style={{ width: "100%", marginBottom: 8, textAlign: "left" }}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
        <div style={{ marginTop: 10, opacity: 0.7, fontSize: 12 }}>{transport.toUpperCase()}</div>
      </div>

      {/* Content */}
      <div style={{ border: "1px solid rgba(255,255,255,0.10)", background: "rgba(0,0,0,0.16)", padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 16 }}>{tab}</div>
            <div style={{ opacity: 0.7, fontSize: 12 }}>{actorName}</div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="hpx-btn" onClick={() => void refreshAll()} disabled={loading}>
              {loading ? "Frissítés…" : "Frissítés"}
            </button>

            {tab === "Dispatch" && (
              <button className="hpx-btn hpx-btnAccent" onClick={() => void testDispatch()}>
                Teszt riasztás
              </button>
            )}

            {tab === "Egységek" && (
              <button className="hpx-btn hpx-btnAccent" onClick={() => void requestUnit()}>
                Egység igénylés
              </button>
            )}

            {tab === "Jelentések" && (
              <button className="hpx-btn hpx-btnAccent" onClick={() => setNewOpen((v) => !v)}>
                {newOpen ? "Új jelentés: bezár" : "Új jelentés"}
              </button>
            )}

            {tab === "BOLO" && (
              <button className="hpx-btn hpx-btnAccent" onClick={() => setBoloNewOpen((v) => !v)}>
                {boloNewOpen ? "Új BOLO: bezár" : "Új BOLO"}
              </button>
            )}
          </div>
        </div>

        {/* ===== Dispatch ===== */}
        {tab === "Dispatch" && (
          <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 12 }}>
            <div style={{ border: "1px solid rgba(255,255,255,0.10)", padding: 10 }}>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>
                Hívások {selectedUnit ? `• Kijelölt egység: ${selectedUnit.callsign}` : ""}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {calls.map((c) => {
                  const unit = c.assignedUnitId ? unitById.get(c.assignedUnitId) : null;
                  const selected = selectedCallId === c.id;
                  const accent = getCallAccent(c.status);

                  return (
                    <div
                      key={c.id}
                      style={{
                        border: `1px solid ${accent.border}`,
                        padding: 10,
                        cursor: "pointer",
                        boxShadow: selected ? "0 0 0 3px rgba(255,216,76,0.10)" : "none",
                      }}
                      onClick={() => {
                        setSelectedCallId(c.id);
                        setDispatchReportDraft(c.reportSummary ?? "");
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ width: 8, height: 8, borderRadius: 999, background: accent.dot, boxShadow: `0 0 12px ${accent.dot}` }} />
                          <div style={{ fontWeight: 900 }}>{c.code} • {c.title}</div>
                        </div>
                        <div style={{ opacity: 0.7 }}>{hhmmss(c.ts)}</div>
                      </div>

                      <div style={{ opacity: 0.78, marginTop: 6, fontSize: 13 }}>{c.location}</div>

                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 10 }}>
                        <div style={{ opacity: 0.75, fontSize: 12 }}>
                          Egység: <b>{unit?.callsign ?? "—"}</b>
                        </div>

                        {!unit && c.status !== "Lezárva" && selectedUnitId && (
                          <button className="hpx-btn hpx-btnAccent" onClick={() => void acceptCall(c.id, selectedUnitId)}>
                            Jelentkezés
                          </button>
                        )}

                        {c.reportId && (
                          <button className="hpx-btn" onClick={() => { setTab("Jelentések"); void openReport(c.reportId!); }}>
                            Jelentés
                          </button>
                        )}

                        <button className="hpx-btn" onClick={() => void setWaypoint(c)} disabled={!c.origin} style={{ opacity: c.origin ? 1 : 0.55 }}>
                          Útvonal
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ border: "1px solid rgba(255,255,255,0.10)", padding: 10 }}>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>Hívás részletek</div>

              {!selectedCall ? (
                <div style={{ opacity: 0.7 }}>Válassz egy hívást.</div>
              ) : (
                <div>
                  <div style={{ fontWeight: 900, marginBottom: 6 }}>{selectedCall.code} • {selectedCall.title}</div>
                  <div style={{ opacity: 0.8, fontSize: 13, marginBottom: 10 }}>{selectedCall.location}</div>

                  {selectedCall.status === "Lezárva" ? (
                    <div style={{ border: "1px solid rgba(47,232,110,0.25)", padding: 10 }}>
                      <div style={{ fontWeight: 900, marginBottom: 6 }}>Lezárva</div>
                      <div style={{ opacity: 0.85, fontSize: 12 }}>{selectedCall.reportSummary ?? "—"}</div>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                        <button className="hpx-btn" onClick={() => void updateCallStatus(selectedCall.id, "Úton")}>Úton</button>
                        <button className="hpx-btn" onClick={() => void updateCallStatus(selectedCall.id, "Helyszínen")}>Helyszínen</button>
                        <button className="hpx-btn" onClick={() => void addNote(selectedCall.id)}>Megjegyzés</button>
                      </div>

                      <div style={{ fontWeight: 900, marginBottom: 6 }}>Lezárás + rövid jelentés</div>
                      <textarea
                        value={dispatchReportDraft}
                        onChange={(e) => setDispatchReportDraft(e.target.value)}
                        placeholder="Rövid jelentés…"
                        style={{ width: "100%", minHeight: 90, padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none" }}
                      />

                      <div style={{ marginTop: 10 }}>
                        <button className="hpx-btn hpx-btnAccent" onClick={() => void closeCall(selectedCall.id)}>
                          Lezárás
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== Units ===== */}
        {tab === "Egységek" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ border: "1px solid rgba(255,255,255,0.10)", padding: 10 }}>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>Járőrök</div>
              <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 10 }}>Drag → egység</div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {officers.filter((o) => o.onDuty).map((o) => (
                  <div
                    key={o.cid}
                    draggable
                    onDragStart={(e) => onOfficerDragStart(o.cid, e)}
                    style={{ border: "1px solid rgba(255,255,255,0.10)", padding: 10, cursor: "grab" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ fontWeight: 900 }}>{o.name}</div>
                      <div style={{ opacity: 0.75, fontSize: 12 }}>CID: {o.cid}</div>
                    </div>
                    <div style={{ opacity: 0.75, fontSize: 12, marginTop: 6 }}>
                      Egység: {o.unitId ? (unitById.get(o.unitId)?.callsign ?? "—") : "—"}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ border: "1px solid rgba(255,255,255,0.10)", padding: 10 }}>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>Egységek</div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {units.length === 0 ? (
                  <div style={{ opacity: 0.7 }}>Nincs egység.</div>
                ) : (
                  units.map((u) => {
                    const available = u.status === "Elérhető";
                    const border = available ? "rgba(47,232,110,0.25)" : "rgba(255,59,59,0.25)";
                    const dot = available ? "#2fe86e" : "#ff3b3b";

                    return (
                      <div key={u.id} onDragOver={allowDrop} onDrop={(e) => void onUnitDrop(u.id, e)} style={{ border: `1px solid ${border}`, padding: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ width: 8, height: 8, borderRadius: 999, background: dot, boxShadow: `0 0 12px ${dot}` }} />
                            <div style={{ fontWeight: 900 }}>{u.callsign}</div>
                          </div>
                          <div style={{ opacity: 0.75, fontSize: 12 }}>{u.status}</div>
                        </div>

                        <div style={{ opacity: 0.75, fontSize: 12, marginTop: 6 }}>
                          Tagok: {u.members.length ? u.members.map((cid) => officerByCid.get(cid)?.name ?? String(cid)).join(", ") : "—"}
                        </div>

                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                          <button className="hpx-btn" onClick={() => setSelectedUnitId(u.id)} style={{ opacity: selectedUnitId === u.id ? 1 : 0.8 }}>
                            Kijelöl
                          </button>
                          <button className="hpx-btn" onClick={() => void setUnitStatus(u.id, "Elérhető")}>Elérhető</button>
                          <button className="hpx-btn" onClick={() => void setUnitStatus(u.id, "Nem elérhető")}>Nem elérhető</button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div style={{ marginTop: 10, opacity: 0.65, fontSize: 12 }}>
                Kijelölt egység: <b>{selectedUnit ? selectedUnit.callsign : "—"}</b>
              </div>
            </div>
          </div>
        )}

        {/* ===== Reports ===== */}
        {tab === "Jelentések" && (
          <div style={{ display: "grid", gridTemplateColumns: "0.9fr 1.1fr", gap: 12 }}>
            <div style={{ border: "1px solid rgba(255,255,255,0.10)", padding: 10 }}>
              <div style={{ fontWeight: 900, marginBottom: 10 }}>Jelentések</div>

              {newOpen && (
                <div style={{ border: "1px solid rgba(255,216,76,0.20)", padding: 10, marginBottom: 10 }}>
                  <div style={{ fontWeight: 900, marginBottom: 8 }}>Új jelentés</div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                    <select value={newType} onChange={(e) => setNewType(e.target.value as any)} className="hpx-btn">
                      {REPORT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>

                    <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Cím…" style={{ width: "min(360px,100%)", padding: "10px 10px", border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", borderRadius: 0, outline: "none" }} />
                    <input value={newLocation} onChange={(e) => setNewLocation(e.target.value)} placeholder="Helyszín…" style={{ width: "min(260px,100%)", padding: "10px 10px", border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", borderRadius: 0, outline: "none" }} />
                  </div>

                  <div style={{ fontWeight: 900, marginBottom: 6 }}>Tagek</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                    {tagCatalog.map((t) => (
                      <button key={t} className={`hpx-btn ${newTags.includes(t) ? "hpx-btnAccent" : ""}`} onClick={() => toggleNewTag(t)}>{t}</button>
                    ))}
                  </div>

                  <button className="hpx-btn hpx-btnAccent" onClick={() => void createReport({ type: newType, title: newTitle.trim() || "—", location: newLocation.trim() || "—", tags: newTags, involved: [], vehicles: [] })}>
                    Létrehozás
                  </button>
                </div>
              )}

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                <input value={reportQuery} onChange={(e) => setReportQuery(e.target.value)} placeholder="Keresés (ID, CID, rendszám)…" style={{ width: "min(300px,100%)", padding: "10px 10px", border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", borderRadius: 0, outline: "none" }} />
                <select value={reportFilterType} onChange={(e) => setReportFilterType(e.target.value as any)} className="hpx-btn">
                  <option value="ALL">Minden típus</option>
                  {REPORT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <select value={reportFilterTag} onChange={(e) => setReportFilterTag(e.target.value)} className="hpx-btn">
                  <option value="">Minden tag</option>
                  {tagCatalog.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <button className="hpx-btn" onClick={() => void refreshReports()}>Szűrés</button>
              </div>

              {canManageTags && (
                <div style={{ border: "1px solid rgba(255,255,255,0.10)", padding: 10, marginBottom: 10 }}>
                  <div style={{ fontWeight: 900, marginBottom: 8 }}>Admin: tag lista</div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                    <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="Új tag…" style={{ width: "min(240px,100%)", padding: "10px 10px", border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", borderRadius: 0, outline: "none" }} />
                    <button className="hpx-btn hpx-btnAccent" onClick={addTagToCatalog}>Hozzáadás</button>
                    <button className="hpx-btn" onClick={() => void saveTagCatalog()}>Mentés</button>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {tagCatalog.map((t) => <button key={t} className="hpx-btn" onClick={() => removeTagFromCatalog(t)}>✕ {t}</button>)}
                  </div>
                </div>
              )}

              {reports.length === 0 ? (
                <div style={{ opacity: 0.7 }}>Nincs jelentés.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {reports.map((r) => (
                    <div key={r.id} style={{ border: "1px solid rgba(255,255,255,0.10)", padding: 10, cursor: "pointer", boxShadow: selectedReportId === r.id ? "0 0 0 3px rgba(255,216,76,0.10)" : "none" }} onClick={() => void openReport(r.id)}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ fontWeight: 900 }}>{r.type} • {r.title}</div>
                        <div style={{ opacity: 0.7, fontSize: 12 }}>{r.id}</div>
                      </div>
                      <div style={{ opacity: 0.75, fontSize: 12, marginTop: 6 }}>
                        Státusz: <b>{r.status === "SUBMITTED" ? "LEADVA" : "PISZKOZAT"}</b> • Utolsó: <b>{r.lastEditorName}</b>
                      </div>
                      <div style={{ opacity: 0.85, fontSize: 12, marginTop: 6 }}>{r.summary}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ border: "1px solid rgba(255,255,255,0.10)", padding: 10 }}>
              <div style={{ fontWeight: 900, marginBottom: 10 }}>Jelentés</div>

              {!reportDetail ? (
                <div style={{ opacity: 0.7 }}>Válassz egy jelentést.</div>
              ) : (
                <div>
                  <div style={{ border: "1px solid rgba(255,255,255,0.10)", padding: 10, marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 900 }}>{reportDetail.id}</div>
                      <div style={{ opacity: 0.85 }}>
                        Státusz: <b>{reportDetail.status === "SUBMITTED" ? "LEADVA" : "PISZKOZAT"}</b>
                      </div>
                    </div>
                    <div style={{ opacity: 0.75, fontSize: 12, marginTop: 6 }}>
                      Létrehozó: <b>{reportDetail.authorName}</b> (CID {reportDetail.authorCid}) • {fmtDate(reportDetail.createdAt)}
                    </div>
                    <div style={{ opacity: 0.75, fontSize: 12, marginTop: 6 }}>
                      Utolsó szerkesztő: <b>{reportDetail.lastEditorName}</b> (CID {reportDetail.lastEditorCid}) • {fmtDate(reportDetail.updatedAt)}
                    </div>
                    <div style={{ opacity: 0.75, fontSize: 12, marginTop: 6 }}>
                      Leadás ideje: <b>{fmtDate(reportDetail.submittedAt)}</b>
                    </div>
                  </div>

                  <div style={{ fontWeight: 900, marginBottom: 6 }}>Tagek</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                    {tagCatalog.map((t) => (
                      <button key={t} className={`hpx-btn ${reportDetail.tags.includes(t) ? "hpx-btnAccent" : ""}`} onClick={() => toggleReportTag(t)} disabled={isReportLocked || reportSaving}>
                        {t}
                      </button>
                    ))}
                  </div>

                  <div style={{ fontWeight: 900, marginBottom: 6 }}>Érintettek</div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                    <input value={addInvolvedCid} onChange={(e) => setAddInvolvedCid(e.target.value)} placeholder="CID…" style={{ width: "min(140px,100%)", padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none" }} disabled={isReportLocked || reportSaving} />
                    <select value={addInvolvedRole} onChange={(e) => setAddInvolvedRole(e.target.value as any)} className="hpx-btn" disabled={isReportLocked || reportSaving}>
                      {INVOLVED_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <button className="hpx-btn hpx-btnAccent" onClick={() => void addInvolvedFromInput()} disabled={isReportLocked || reportSaving}>Hozzáadás</button>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                    {reportDetail.involved.length === 0 ? (
                      <div style={{ opacity: 0.7 }}>—</div>
                    ) : (
                      reportDetail.involved.map((inv) => (
                        <div key={inv.cid} style={{ border: "1px solid rgba(255,255,255,0.10)", padding: 8, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                          <div style={{ fontWeight: 900 }}>{inv.name}</div>
                          <div style={{ opacity: 0.75, fontSize: 12 }}>CID: {inv.cid}</div>
                          <select value={inv.role} onChange={(e) => updateInvolvedRole(inv.cid, e.target.value as any)} className="hpx-btn" disabled={isReportLocked || reportSaving}>
                            {INVOLVED_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                          </select>
                          <button className="hpx-btn" onClick={() => removeInvolved(inv.cid)} disabled={isReportLocked || reportSaving}>Eltávolítás</button>
                        </div>
                      ))
                    )}
                  </div>

                  <div style={{ fontWeight: 900, marginBottom: 6 }}>Érintett járművek (rendszám)</div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                    <input value={addVehiclePlate} onChange={(e) => setAddVehiclePlate(e.target.value)} placeholder="Rendszám…" style={{ width: "min(180px,100%)", padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none" }} disabled={isReportLocked || reportSaving} />
                    <button className="hpx-btn hpx-btnAccent" onClick={addVehicleToReport} disabled={isReportLocked || reportSaving}>Hozzáadás</button>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                    {reportDetail.vehicles.length === 0 ? (
                      <div style={{ opacity: 0.7 }}>—</div>
                    ) : (
                      reportDetail.vehicles.map((pl) => (
                        <button key={pl} className="hpx-btn" onClick={() => removeVehicleFromReport(pl)} disabled={isReportLocked || reportSaving}>✕ {pl}</button>
                      ))
                    )}
                  </div>

                  <ReportEditor valueHtml={reportDetail.fullText} onChangeHtml={(html) => setReportDetail({ ...reportDetail, fullText: html })} disabled={isReportLocked || reportSaving} />

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
                    <button className="hpx-btn" onClick={() => setReportDetail(null)} disabled={reportSaving}>Bezárás</button>
                    <button className="hpx-btn hpx-btnAccent" onClick={() => void saveReport()} disabled={isReportLocked || reportSaving}>{reportSaving ? "Mentés…" : "Mentés"}</button>
                    <button className="hpx-btn hpx-btnAccent" onClick={() => void submitReport()} disabled={isReportLocked || reportSaving}>Leadás</button>
                  </div>

                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontWeight: 900, marginBottom: 6 }}>Timeline (audit)</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {reportDetail.timeline.map((t: MdtReportTimelineItem) => (
                        <div key={t.id} style={{ border: "1px solid rgba(255,255,255,0.10)", padding: 8 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                            <div style={{ fontWeight: 900 }}>{t.action}</div>
                            <div style={{ opacity: 0.7, fontSize: 12 }}>{fmtDate(t.ts)}</div>
                          </div>
                          <div style={{ opacity: 0.75, fontSize: 12 }}>
                            {t.name} (CID: {t.cid}) {t.changes ? `• ${t.changes}` : ""}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginTop: 10, opacity: 0.65, fontSize: 12 }}>
                    Törlés nincs. Leadás után a jelentés nem módosítható.
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== Person ===== */}
        {tab === "Személy" && (
          <div style={{ display: "grid", gridTemplateColumns: "0.9fr 1.1fr", gap: 12 }}>
            <div style={{ border: "1px solid rgba(255,255,255,0.10)", padding: 10 }}>
              <div style={{ fontWeight: 900, marginBottom: 10 }}>Személy keresés</div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                <input value={personQuery} onChange={(e) => setPersonQuery(e.target.value)} placeholder="Név vagy CID…" style={{ width: "min(360px,100%)", padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none" }} />
                <button className="hpx-btn hpx-btnAccent" onClick={() => void searchPerson()}>Keresés</button>
              </div>

              {personResults.length === 0 ? (
                <div style={{ opacity: 0.7 }}>—</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {personResults.map((p) => (
                    <div key={p.cid} style={{ border: "1px solid rgba(255,255,255,0.10)", padding: 10, cursor: "pointer" }} onClick={() => void openPerson(p.cid)}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ fontWeight: 900 }}>{p.name}</div>
                        <div style={{ opacity: 0.7 }}>CID: {p.cid}</div>
                      </div>
                      <div style={{ opacity: 0.75, fontSize: 12, marginTop: 6 }}>Telefon: {p.phone ?? "—"} • Munka: {p.job ?? "—"}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ border: "1px solid rgba(255,255,255,0.10)", padding: 10 }}>
              <div style={{ fontWeight: 900, marginBottom: 10 }}>Profil</div>
              {!selectedPerson ? (
                <div style={{ opacity: 0.7 }}>Válassz egy személyt.</div>
              ) : (
                <div>
                  <div style={{ fontWeight: 900, fontSize: 16 }}>{selectedPerson.name}</div>
                  <div style={{ opacity: 0.75, fontSize: 12, marginTop: 6 }}>
                    CID: <b>{selectedPerson.cid}</b> • Telefon: <b>{selectedPerson.phone ?? "—"}</b> • Munka: <b>{selectedPerson.job ?? "—"}</b>
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                    <button className="hpx-btn hpx-btnAccent" onClick={() => void createReportForPerson()}>Új jelentés ehhez</button>
                  </div>

                  <div style={{ fontWeight: 900, marginTop: 14, marginBottom: 8 }}>Kapcsolt jelentések ({personLinkedReports.length})</div>

                  {personLinkedReports.length === 0 ? (
                    <div style={{ opacity: 0.7 }}>Nincs kapcsolt jelentés.</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {personLinkedReports.slice(0, 20).map((r) => (
                        <div key={r.id} style={{ border: "1px solid rgba(255,255,255,0.10)", padding: 10, cursor: "pointer" }} onClick={() => { setTab("Jelentések"); void openReport(r.id); }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                            <div style={{ fontWeight: 900 }}>{r.type} • {r.title}</div>
                            <div style={{ opacity: 0.7, fontSize: 12 }}>{r.id}</div>
                          </div>
                          <div style={{ opacity: 0.85, fontSize: 12, marginTop: 6 }}>{r.summary}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== Vehicle ===== */}
        {tab === "Jármű" && (
          <div style={{ display: "grid", gridTemplateColumns: "0.9fr 1.1fr", gap: 12 }}>
            <div style={{ border: "1px solid rgba(255,255,255,0.10)", padding: 10 }}>
              <div style={{ fontWeight: 900, marginBottom: 10 }}>Jármű keresés</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                <input value={vehicleQuery} onChange={(e) => setVehicleQuery(e.target.value)} placeholder="Rendszám / modell / tulaj…" style={{ width: "min(360px,100%)", padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none" }} />
                <button className="hpx-btn hpx-btnAccent" onClick={() => void searchVehicle()}>Keresés</button>
              </div>

              {vehicleResults.length === 0 ? (
                <div style={{ opacity: 0.7 }}>—</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {vehicleResults.map((v) => (
                    <div key={v.plate} style={{ border: "1px solid rgba(255,255,255,0.10)", padding: 10, cursor: "pointer" }} onClick={() => void openVehicle(v.plate)}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ fontWeight: 900 }}>{v.plate}</div>
                        <div style={{ opacity: 0.7 }}>{v.model}</div>
                      </div>
                      <div style={{ opacity: 0.75, fontSize: 12, marginTop: 6 }}>Tulaj: {v.ownerName ?? "—"} • Szín: {v.color ?? "—"}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ border: "1px solid rgba(255,255,255,0.10)", padding: 10 }}>
              <div style={{ fontWeight: 900, marginBottom: 10 }}>Jármű profil</div>
              {!selectedVehicle ? (
                <div style={{ opacity: 0.7 }}>Válassz egy járművet.</div>
              ) : (
                <div>
                  <div style={{ fontWeight: 900, fontSize: 16 }}>{selectedVehicle.plate} • {selectedVehicle.model}</div>
                  <div style={{ opacity: 0.75, fontSize: 12, marginTop: 6 }}>Szín: <b>{selectedVehicle.color ?? "—"}</b> • Tulaj: <b>{selectedVehicle.ownerName ?? "—"}</b></div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                    <button className="hpx-btn hpx-btnAccent" onClick={() => void createReportForVehicle()}>Új jelentés ehhez a járműhöz</button>
                  </div>

                  <div style={{ fontWeight: 900, marginTop: 14, marginBottom: 8 }}>Kapcsolt jelentések ({vehicleLinkedReports.length})</div>

                  {vehicleLinkedReports.length === 0 ? (
                    <div style={{ opacity: 0.7 }}>Nincs kapcsolt jelentés.</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {vehicleLinkedReports.slice(0, 20).map((r) => (
                        <div key={r.id} style={{ border: "1px solid rgba(255,255,255,0.10)", padding: 10, cursor: "pointer" }} onClick={() => { setTab("Jelentések"); void openReport(r.id); }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                            <div style={{ fontWeight: 900 }}>{r.type} • {r.title}</div>
                            <div style={{ opacity: 0.7, fontSize: 12 }}>{r.id}</div>
                          </div>
                          <div style={{ opacity: 0.85, fontSize: 12, marginTop: 6 }}>{r.summary}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== BOLO ===== */}
        {tab === "BOLO" && (
          <div style={{ display: "grid", gridTemplateColumns: "0.95fr 1.05fr", gap: 12 }}>
            <div style={{ border: "1px solid rgba(255,255,255,0.10)", padding: 10 }}>
              <div style={{ fontWeight: 900, marginBottom: 10 }}>BOLO lista</div>

              {boloNewOpen && (
                <div style={{ border: "1px solid rgba(255,216,76,0.20)", padding: 10, marginBottom: 10 }}>
                  <div style={{ fontWeight: 900, marginBottom: 8 }}>Új BOLO</div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                    <select value={boloNewType} onChange={(e) => setBoloNewType(e.target.value as any)} className="hpx-btn">
                      {BOLO_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <select value={boloNewPriority} onChange={(e) => setBoloNewPriority(e.target.value as any)} className="hpx-btn">
                      {BOLO_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>

                  <input value={boloNewTitle} onChange={(e) => setBoloNewTitle(e.target.value)} placeholder="Cím…" style={{ width: "100%", padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none", marginBottom: 10 }} />
                  <textarea value={boloNewDesc} onChange={(e) => setBoloNewDesc(e.target.value)} placeholder="Leírás…" style={{ width: "100%", minHeight: 80, padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none", marginBottom: 10 }} />

                  <div style={{ fontWeight: 900, marginBottom: 6 }}>Tagek</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                    {tagCatalog.map((t) => <button key={t} className={`hpx-btn ${boloNewTags.includes(t) ? "hpx-btnAccent" : ""}`} onClick={() => toggleBoloNewTag(t)}>{t}</button>)}
                  </div>

                  <input value={boloNewPeopleCsv} onChange={(e) => setBoloNewPeopleCsv(e.target.value)} placeholder="CID-k vesszővel (pl. 1001,1002)" style={{ width: "100%", padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none", marginBottom: 10 }} />
                  <input value={boloNewVehiclesCsv} onChange={(e) => setBoloNewVehiclesCsv(e.target.value)} placeholder="Rendszámok vesszővel (pl. ABC123,PD-01)" style={{ width: "100%", padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none", marginBottom: 10 }} />
                  <input value={boloNewReportsCsv} onChange={(e) => setBoloNewReportsCsv(e.target.value)} placeholder="Report ID-k vesszővel (opcionális)" style={{ width: "100%", padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none", marginBottom: 10 }} />
                  <input value={boloNewExpiresMin} onChange={(e) => setBoloNewExpiresMin(e.target.value)} placeholder="Lejárat percben (pl. 60) – üres = nincs" style={{ width: "100%", padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none", marginBottom: 10 }} />

                  <button className="hpx-btn hpx-btnAccent" onClick={() => void createBolo()}>Létrehozás</button>
                </div>
              )}

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                <input value={boloQuery} onChange={(e) => setBoloQuery(e.target.value)} placeholder="Keresés…" style={{ width: "min(320px,100%)", padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none" }} />

                <select value={boloFilterStatus} onChange={(e) => setBoloFilterStatus(e.target.value as any)} className="hpx-btn">
                  {BOLO_STATUSES.map((s) => <option key={s} value={s}>{s === "ALL" ? "Minden státusz" : s}</option>)}
                </select>

                <select value={boloFilterType} onChange={(e) => setBoloFilterType(e.target.value as any)} className="hpx-btn">
                  <option value="ALL">Minden típus</option>
                  {BOLO_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>

                <select value={boloFilterPriority} onChange={(e) => setBoloFilterPriority(e.target.value as any)} className="hpx-btn">
                  <option value="ALL">Minden prioritás</option>
                  {BOLO_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>

                <button className="hpx-btn" onClick={() => void refreshBolos()}>Szűrés</button>
              </div>

              {bolos.length === 0 ? (
                <div style={{ opacity: 0.7 }}>Nincs BOLO.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {bolos.map((b) => (
                    <div key={b.id} style={{ border: "1px solid rgba(255,255,255,0.10)", padding: 10, cursor: "pointer", boxShadow: selectedBoloId === b.id ? "0 0 0 3px rgba(255,216,76,0.10)" : "none" }} onClick={() => void openBolo(b.id)}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ width: 8, height: 8, borderRadius: 999, background: boloPriorityDot(b.priority), boxShadow: `0 0 12px ${boloPriorityDot(b.priority)}` }} />
                          <div style={{ fontWeight: 900 }}>{b.type} • {b.title}</div>
                        </div>
                        <div style={{ opacity: 0.7, fontSize: 12 }}>{b.status}</div>
                      </div>
                      <div style={{ opacity: 0.75, fontSize: 12, marginTop: 6 }}>Prioritás: <b>{b.priority}</b> • Tagek: <b>{b.tags.join(", ") || "—"}</b></div>
                      <div style={{ opacity: 0.85, fontSize: 12, marginTop: 6 }}>{b.description}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ border: "1px solid rgba(255,255,255,0.10)", padding: 10 }}>
              <div style={{ fontWeight: 900, marginBottom: 10 }}>BOLO részletek</div>

              {!selectedBolo ? (
                <div style={{ opacity: 0.7 }}>Válassz egy BOLO-t.</div>
              ) : (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 900, fontSize: 16 }}>{selectedBolo.title}</div>
                    <div style={{ opacity: 0.75 }}>{selectedBolo.status}</div>
                  </div>

                  <div style={{ opacity: 0.75, marginTop: 6, fontSize: 12 }}>
                    Típus: <b>{selectedBolo.type}</b> • Prioritás: <b>{selectedBolo.priority}</b>
                  </div>

                  <div style={{ opacity: 0.88, marginTop: 10, whiteSpace: "pre-wrap" }}>{selectedBolo.description}</div>

                  <div style={{ marginTop: 12, opacity: 0.75, fontSize: 12 }}>
                    Tagek: <b>{selectedBolo.tags.join(", ") || "—"}</b>
                  </div>

                  <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 900, marginBottom: 6 }}>Személyek</div>
                      {selectedBolo.people.length === 0 ? (
                        <div style={{ opacity: 0.7 }}>—</div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {selectedBolo.people.map((cid: number) => (
                            <button key={cid} className="hpx-btn" onClick={() => { setTab("Személy"); void openPerson(cid); }}>
                              CID {cid} (megnyitás)
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <div style={{ fontWeight: 900, marginBottom: 6 }}>Járművek</div>
                      {selectedBolo.vehicles.length === 0 ? (
                        <div style={{ opacity: 0.7 }}>—</div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {selectedBolo.vehicles.map((pl: string) => (
                            <button key={pl} className="hpx-btn" onClick={() => { setTab("Jármű"); void openVehicle(pl); }}>
                              {pl} (megnyitás)
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                    <button className="hpx-btn" onClick={() => void updateBoloStatus("Aktív")} disabled={selectedBolo.status === "Aktív"}>Aktiválás</button>
                    <button className="hpx-btn" onClick={() => void updateBoloStatus("Felfüggesztve")} disabled={selectedBolo.status === "Felfüggesztve"}>Felfüggesztés</button>
                    <button className="hpx-btn hpx-btnAccent" onClick={() => void updateBoloStatus("Lezárva")} disabled={selectedBolo.status === "Lezárva"}>Lezárás</button>
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontWeight: 900, marginBottom: 6 }}>Láttam / ellenőriztem</div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <input value={boloSightingNote} onChange={(e) => setBoloSightingNote(e.target.value)} placeholder="Megjegyzés (opcionális)…" style={{ width: "min(360px,100%)", padding: "10px 10px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.18)", color: "rgba(255,255,255,0.92)", outline: "none" }} />
                      <button className="hpx-btn hpx-btnAccent" onClick={() => void markBoloSighting()}>Rögzítés</button>
                    </div>
                  </div>

                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontWeight: 900, marginBottom: 6 }}>Timeline</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {selectedBolo.timeline.map((t: MdtBoloTimelineItem) => (
                        <div key={t.id} style={{ border: "1px solid rgba(255,255,255,0.10)", padding: 8 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                            <div style={{ fontWeight: 900 }}>{t.action}</div>
                            <div style={{ opacity: 0.7, fontSize: 12 }}>{fmtDate(t.ts)}</div>
                          </div>
                          <div style={{ opacity: 0.75, fontSize: 12 }}>
                            {t.name} (CID: {t.cid}) {t.note ? `• ${t.note}` : ""}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
