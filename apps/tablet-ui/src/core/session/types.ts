export type Role = "civ" | "police" | "ems" | "admin";

export type PlayerContext = {
  serverId: number;
  name: string;
  role: Role;

  jobLabel: string;
  callsign?: string | null;

  duty: boolean;
  transport: "mock" | "nui";

  // Magyar komment: opcionális extra mezők (később HPX integrációból)
  jobName?: string | null;
  jobGrade?: number | null;
  cash?: number | null;
  bank?: number | null;
};
