import type { ComponentType, ReactNode } from "react";
import type { Role } from "./session/types";

export type TabletAppId =
  | "profile"
  | "mdt"
  | "cases"
  | "evidence"
  | "bank"
  | "business"
  | "settings"
  | "notes"
  | "iktatas"
;

export type TabletAppManifest = {
  id: TabletAppId;
  title: string;
  icon: ReactNode;

  dockDefault: boolean;
  requiredRoles?: Role[];

  load: () => Promise<{ default: ComponentType }>;
};

export const APPS: TabletAppManifest[] = [
  { id: "profile",  title: "Profil",       icon: <span>👤</span>, dockDefault: true,  load: () => import("../apps/profile/ProfileApp") },
  { id: "mdt",      title: "MDT",          icon: <span>🛡️</span>, dockDefault: true,  requiredRoles: ["police", "admin"], load: () => import("../apps/mdt/MdtApp") },
  { id: "cases",    title: "Ügyek",        icon: <span>📁</span>, dockDefault: true,  requiredRoles: ["police", "admin"], load: () => import("../apps/cases/CasesApp") },
  { id: "iktatas", title: "Iktatás", icon: <span>🗂️</span>, dockDefault: true, requiredRoles: ["police", "admin"], load: () => import("../apps/iktatas/IktatasApp") },
  { id: "evidence", title: "Bizonyítékok", icon: <span>🧾</span>, dockDefault: true,  requiredRoles: ["police", "admin"], load: () => import("../apps/evidence/EvidenceApp") },
  { id: "bank",     title: "Bank",         icon: <span>🏦</span>, dockDefault: true,  load: () => import("../apps/bank/BankApp") },
  { id: "business", title: "Vállalkozás",  icon: <span>🏢</span>, dockDefault: true,  load: () => import("../apps/business/BusinessApp") },
  { id: "settings", title: "Beállítások",  icon: <span>⚙️</span>, dockDefault: true,  load: () => import("../apps/settings/SettingsApp") },
  { id: "notes",    title: "Jegyzetek",    icon: <span>📝</span>, dockDefault: false, load: () => import("../apps/notes/NotesApp") },
];
