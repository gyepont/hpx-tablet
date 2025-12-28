export type BankSummary = {
  cash: number;
  bank: number;
  iban?: string | null;
};

export type MdtUnitStatus = "Elérhető" | "Nem elérhető";
export type MdtCallStatus = "Új" | "Elfogadva" | "Úton" | "Helyszínen" | "Lezárva";

export type MdtOfficer = {
  cid: number;
  name: string;
  onDuty: boolean;
  callsign?: string | null;
  unitId?: string | null;
};

export type MdtUnit = {
  id: string;
  callsign: string;
  label: string;
  members: number[];
  status: MdtUnitStatus;
  updatedAt: string;
};

export type MdtCallTimelineItem = {
  id: string;
  ts: string;
  cid: number;
  name: string;
  action: string;
  note?: string | null;
};

export type MdtDispatchCall = {
  id: string;
  code: string;
  title: string;
  location: string;
  ts: string;
  origin?: { x: number; y: number; z: number } | null;

  status: MdtCallStatus;
  assignedUnitId?: string | null;

  timeline: MdtCallTimelineItem[];

  reportSummary?: string | null;
  reportId?: string | null;
};

export type MdtReportType =
  | "Igazoltatás"
  | "Intézkedés"
  | "Incidens"
  | "Nyomozás"
  | "Dispatch"
  | "Egyéb";

export type MdtInvolvedRole = "Gyanúsított" | "Tanú" | "Áldozat" | "Egyéb";

export type MdtReportInvolved = {
  cid: number;
  name: string;
  role: MdtInvolvedRole;
};

// ===== Report Audit =====
export type MdtReportStatus = "DRAFT" | "SUBMITTED";

export type MdtReportTimelineAction = "Létrehozva" | "Mentve" | "Leadva";

export type MdtReportTimelineItem = {
  id: string;
  ts: string;
  cid: number;
  name: string;
  action: MdtReportTimelineAction;
  changes?: string | null; // Magyar komment: rövid, emberi “diff” (mit változott)
};

export type MdtReport = {
  id: string;

  type: MdtReportType;
  tags: string[];

  involved: MdtReportInvolved[];
  vehicles: string[]; // rendszámok

  status: MdtReportStatus;
  submittedAt?: string | null;

  createdAt: string;
  updatedAt: string;

  // Magyar komment: ki hozta létre (eredeti szerző)
  authorCid: number;
  authorName: string;

  // Magyar komment: ki mentette utoljára
  lastEditorCid: number;
  lastEditorName: string;

  title: string;
  location: string;

  summary: string;
  fullText: string; // HTML (WYSIWYG)

  timeline: MdtReportTimelineItem[];
};

export type MdtPerson = {
  cid: number;
  name: string;
  dob?: string | null;
  phone?: string | null;
  job?: string | null;
  flags?: string[];
};

export type MdtVehicle = {
  plate: string;
  model: string;
  color?: string | null;

  ownerCid?: number | null;
  ownerName?: string | null;

  flags?: string[];
  notes?: string | null;
};

// ===== BOLO =====
export type MdtBoloType = "Személy" | "Jármű" | "Általános";
export type MdtBoloPriority = "Alacsony" | "Közepes" | "Magas" | "Kritikus";
export type MdtBoloStatus = "Aktív" | "Felfüggesztve" | "Lezárva";

export type MdtBoloTimelineItem = {
  id: string;
  ts: string;
  cid: number;
  name: string;
  action: "Létrehozva" | "Frissítve" | "Láttam" | "Felfüggesztve" | "Újraaktiválva" | "Lezárva";
  note?: string | null;
};

export type MdtBolo = {
  id: string;

  type: MdtBoloType;
  priority: MdtBoloPriority;
  status: MdtBoloStatus;

  title: string;
  description: string;

  tags: string[];

  people: number[];
  vehicles: string[];
  reportIds: string[];

  expiresAt?: string | null;

  createdAt: string;
  updatedAt: string;

  createdByCid: number;
  createdByName: string;

  timeline: MdtBoloTimelineItem[];
};
