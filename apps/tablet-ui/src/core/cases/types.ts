export type CaseStatus = "Nyitott" | "Folyamatban" | "Vádemelés" | "Lezárt";
export type CasePriority = "Alacsony" | "Közepes" | "Magas" | "Kritikus";

export type CaseItem = {
  id: string;
  caseNumber: string; // Iktatószám (pl. HPX-2025-000123)

  title: string;
  description: string;

  status: CaseStatus;
  priority: CasePriority;

  location: string;
  tags: string[];

  linkedReportIds: string[];
  linkedEvidenceIds: string[];
  linkedBoloIds: string[];

  createdAt: string;
  updatedAt: string;
};
