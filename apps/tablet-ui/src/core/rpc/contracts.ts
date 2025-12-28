import type { PlayerContext } from "../session/types";
import type {
  BankSummary,
  MdtOfficer,
  MdtUnit,
  MdtUnitStatus,
  MdtDispatchCall,
  MdtCallStatus,
  MdtReport,
  MdtReportType,
  MdtPerson,
  MdtReportInvolved,
  MdtVehicle,
  MdtBolo,
  MdtBoloType,
  MdtBoloStatus,
  MdtBoloPriority
} from "../mdt/types";

export type RpcRoutes = {
  "tablet:ping": { req: { message: string }; res: { ok: true; echoed: string; ts: string; transport: "mock" | "nui" } };
  "tablet:getState": { req: {}; res: { ok: true; ts: string; transport: "mock" | "nui" } };
  "tablet:getGameTime": { req: {}; res: { ok: true; hours: number; minutes: number; transport: "mock" | "nui" } };

  "tablet:getPlayerContext": { req: {}; res: { ok: true; context: PlayerContext } };
  "tablet:setDuty": { req: { duty: boolean }; res: { ok: true; duty: boolean } };

  "bank:getSummary": { req: {}; res: { ok: true; summary: BankSummary; transport: "mock" | "nui" } };

  "mdt:getRoster": { req: {}; res: { ok: true; officers: MdtOfficer[]; transport: "mock" | "nui" } };

  "mdt:getUnits": { req: {}; res: { ok: true; units: MdtUnit[]; transport: "mock" | "nui" } };
  "mdt:requestUnit": { req: { callsign: string; label?: string }; res: { ok: true; unit: MdtUnit; transport: "mock" | "nui" } };
  "mdt:addUnitMember": { req: { unitId: string; cid: number }; res: { ok: true; unit: MdtUnit; transport: "mock" | "nui" } };
  "mdt:setUnitStatus": { req: { unitId: string; status: MdtUnitStatus; actorCid: number; actorName: string }; res: { ok: true; unit: MdtUnit; transport: "mock" | "nui" } };

  "mdt:getDispatchFeed": { req: { limit?: number }; res: { ok: true; calls: MdtDispatchCall[]; transport: "mock" | "nui" } };
  "mdt:testDispatch": { req: { code?: string; title?: string; location?: string }; res: { ok: true } };

  "mdt:acceptCall": { req: { callId: string; unitId: string; actorCid: number; actorName: string }; res: { ok: true; call: MdtDispatchCall; transport: "mock" | "nui" } };
  "mdt:updateCallStatus": { req: { callId: string; status: MdtCallStatus; actorCid: number; actorName: string; note?: string | null }; res: { ok: true; call: MdtDispatchCall; transport: "mock" | "nui" } };
  "mdt:addCallNote": { req: { callId: string; actorCid: number; actorName: string; note: string }; res: { ok: true; call: MdtDispatchCall; transport: "mock" | "nui" } };
  "mdt:closeCall": { req: { callId: string; actorCid: number; actorName: string; report: string }; res: { ok: true; call: MdtDispatchCall; transport: "mock" | "nui" } };

  "mdt:getTagCatalog": { req: {}; res: { ok: true; tags: string[]; transport: "mock" | "nui" } };
  "mdt:setTagCatalog": { req: { tags: string[] }; res: { ok: true; tags: string[]; transport: "mock" | "nui" } };

  "mdt:createReport": {
    req: {
      type: MdtReportType;
      title: string;
      location: string;
      tags?: string[];
      involved?: MdtReportInvolved[];
      vehicles?: string[];
      fullText?: string | null;

      actorCid: number;
      actorName: string;
    };
    res: { ok: true; report: MdtReport; transport: "mock" | "nui" };
  };

  "mdt:getReports": {
    req: { query?: string; limit?: number; tag?: string; type?: MdtReportType | "ALL" };
    res: { ok: true; reports: MdtReport[]; transport: "mock" | "nui" };
  };

  "mdt:getReport": { req: { reportId: string }; res: { ok: true; report: MdtReport; transport: "mock" | "nui" } };

  "mdt:updateReport": {
    req: {
      reportId: string;
      fullText: string;
      tags?: string[];
      involved?: MdtReportInvolved[];
      vehicles?: string[];

      actorCid: number;
      actorName: string;
    };
    res: { ok: true; report: MdtReport; transport: "mock" | "nui" };
  };

  "mdt:submitReport": {
    req: { reportId: string; actorCid: number; actorName: string };
    res: { ok: true; report: MdtReport; transport: "mock" | "nui" };
  };

  "mdt:searchPerson": { req: { query: string; limit?: number }; res: { ok: true; persons: MdtPerson[]; transport: "mock" | "nui" } };
  "mdt:getPerson": { req: { cid: number }; res: { ok: true; person: MdtPerson; transport: "mock" | "nui" } };

  "mdt:searchVehicle": { req: { query: string; limit?: number }; res: { ok: true; vehicles: MdtVehicle[]; transport: "mock" | "nui" } };
  "mdt:getVehicle": { req: { plate: string }; res: { ok: true; vehicle: MdtVehicle; transport: "mock" | "nui" } };

  // ===== BOLO =====
  "mdt:getBolos": { req: { query?: string; limit?: number; status?: MdtBoloStatus | "ALL"; type?: MdtBoloType | "ALL"; priority?: MdtBoloPriority | "ALL" }; res: { ok: true; bolos: MdtBolo[]; transport: "mock" | "nui" } };
  "mdt:getBolo": { req: { boloId: string }; res: { ok: true; bolo: MdtBolo; transport: "mock" | "nui" } };
  "mdt:createBolo": { req: { type: MdtBoloType; priority: MdtBoloPriority; title: string; description: string; tags?: string[]; people?: number[]; vehicles?: string[]; reportIds?: string[]; expiresInMinutes?: number | null; actorCid: number; actorName: string }; res: { ok: true; bolo: MdtBolo; transport: "mock" | "nui" } };
  "mdt:updateBolo": { req: { boloId: string; status?: MdtBoloStatus; actorCid: number; actorName: string }; res: { ok: true; bolo: MdtBolo; transport: "mock" | "nui" } };
  "mdt:boloSighting": { req: { boloId: string; note?: string | null; actorCid: number; actorName: string }; res: { ok: true; bolo: MdtBolo; transport: "mock" | "nui" } };

  "mdt:setWaypoint": { req: { x: number; y: number; z?: number }; res: { ok: true } };

  "tablet:close": { req: {}; res: { ok: true } };
};

export type RpcEvent = keyof RpcRoutes;
export type RpcRequest<K extends RpcEvent> = RpcRoutes[K]["req"];
export type RpcResponse<K extends RpcEvent> = RpcRoutes[K]["res"];
