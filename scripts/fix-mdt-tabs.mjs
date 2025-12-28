/**
 * Magyar komment: MDT tabok javítása (implicit any + selectedUnit hiány).
 * - Beolvassa a tabs/*.tsx fájlokat
 * - Kiveszi a JSX return blokkot változtatás nélkül
 * - Újraírja a fájl elejét úgy, hogy a tömbök/objektumok típust kapjanak
 *   -> nem lesz TS7006 (implicit any) a map callback paramétereken
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TABS_DIR = path.join(ROOT, "apps", "tablet-ui", "src", "apps", "mdt", "tabs");

function read(p) {
  return fs.readFileSync(p, "utf8");
}
function write(p, s) {
  fs.writeFileSync(p, s, "utf8");
}

function extractJsxReturnBlock(src) {
  const m = src.match(/return\s*\(\s*([\s\S]*?)\s*\);\s*\}\s*$/m);
  if (!m) throw new Error("Nem találom a return(...) blokkot.");
  return m[1].trimEnd();
}

function extractDestructureVars(src) {
  const m = src.match(/const\s*\{\s*([\s\S]*?)\s*\}\s*=\s*props\s+as\s+any;/m);
  if (!m) return [];
  const raw = m[1];
  // soronként: "name," vagy "name: alias,"
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((l) => l.replace(/[,]/g, ""))
    .map((l) => l.split(/\s+/)[0]) // első token elég
    .filter((x) => x !== "}" && x !== "{");
}

// Magyar komment: mely változókat szeretnénk "raw"-ra bontani és típussal visszaadni
const RENAME_SETS = {
  DispatchTab: {
    imports: `import type { MdtDispatchCall } from "../../../core/mdt/types";\n`,
    renames: {
      calls: "callsRaw",
    },
    typedLines: [
      `  const calls = (callsRaw ?? []) as MdtDispatchCall[];`,
    ],
  },

  UnitsTab: {
    imports: `import type { MdtOfficer, MdtUnit } from "../../../core/mdt/types";\n`,
    renames: {
      officers: "officersRaw",
      units: "unitsRaw",
    },
    typedLines: [
      `  const officers = (officersRaw ?? []) as MdtOfficer[];`,
      `  const units = (unitsRaw ?? []) as MdtUnit[];`,
      `  const selectedUnit = selectedUnitId ? ((unitById?.get(selectedUnitId) ?? null) as MdtUnit | null) : null;`,
    ],
  },

  ReportsTab: {
    imports:
`import type { MdtReport, MdtReportType, MdtInvolvedRole } from "../../../core/mdt/types";\n` +
`import ReportEditor from "../ReportEditor";\n`,
    renames: {
      reports: "reportsRaw",
      tagCatalog: "tagCatalogRaw",
      REPORT_TYPES: "reportTypesRaw",
      INVOLVED_ROLES: "involvedRolesRaw",
      reportDetail: "reportDetailRaw",
      reportFilterType: "reportFilterTypeRaw",
      newType: "newTypeRaw",
      newTags: "newTagsRaw",
      addInvolvedRole: "addInvolvedRoleRaw",
    },
    typedLines: [
      `  const reports = (reportsRaw ?? []) as MdtReport[];`,
      `  const tagCatalog = (tagCatalogRaw ?? []) as string[];`,
      `  const REPORT_TYPES = (reportTypesRaw ?? []) as MdtReportType[];`,
      `  const INVOLVED_ROLES = (involvedRolesRaw ?? []) as MdtInvolvedRole[];`,
      `  const reportDetail = (reportDetailRaw ?? null) as MdtReport | null;`,
      `  const reportFilterType = (reportFilterTypeRaw ?? "ALL") as MdtReportType | "ALL";`,
      `  const newType = (newTypeRaw ?? "Igazoltatás") as MdtReportType;`,
      `  const newTags = (newTagsRaw ?? []) as string[];`,
      `  const addInvolvedRole = (addInvolvedRoleRaw ?? "Egyéb") as MdtInvolvedRole;`,
    ],
  },

  PersonTab: {
    imports: `import type { MdtPerson, MdtReport } from "../../../core/mdt/types";\n`,
    renames: {
      personResults: "personResultsRaw",
      personLinkedReports: "personLinkedReportsRaw",
    },
    typedLines: [
      `  const personResults = (personResultsRaw ?? []) as MdtPerson[];`,
      `  const personLinkedReports = (personLinkedReportsRaw ?? []) as MdtReport[];`,
    ],
  },

  VehicleTab: {
    imports: `import type { MdtVehicle, MdtReport } from "../../../core/mdt/types";\n`,
    renames: {
      vehicleResults: "vehicleResultsRaw",
      vehicleLinkedReports: "vehicleLinkedReportsRaw",
    },
    typedLines: [
      `  const vehicleResults = (vehicleResultsRaw ?? []) as MdtVehicle[];`,
      `  const vehicleLinkedReports = (vehicleLinkedReportsRaw ?? []) as MdtReport[];`,
    ],
  },

  BoloTab: {
    imports:
`import type { MdtBolo, MdtBoloType, MdtBoloPriority, MdtBoloStatus } from "../../../core/mdt/types";\n`,
    renames: {
      BOLO_TYPES: "boloTypesRaw",
      BOLO_PRIORITIES: "boloPrioritiesRaw",
      BOLO_STATUSES: "boloStatusesRaw",
      tagCatalog: "tagCatalogRaw",
      boloNewTags: "boloNewTagsRaw",
      bolos: "bolosRaw",
      selectedBolo: "selectedBoloRaw",
      boloNewType: "boloNewTypeRaw",
      boloNewPriority: "boloNewPriorityRaw",
      boloFilterStatus: "boloFilterStatusRaw",
      boloFilterType: "boloFilterTypeRaw",
      boloFilterPriority: "boloFilterPriorityRaw",
    },
    typedLines: [
      `  const BOLO_TYPES = (boloTypesRaw ?? []) as MdtBoloType[];`,
      `  const BOLO_PRIORITIES = (boloPrioritiesRaw ?? []) as MdtBoloPriority[];`,
      `  const BOLO_STATUSES = (boloStatusesRaw ?? []) as (MdtBoloStatus | "ALL")[];`,
      `  const tagCatalog = (tagCatalogRaw ?? []) as string[];`,
      `  const boloNewTags = (boloNewTagsRaw ?? []) as string[];`,
      `  const bolos = (bolosRaw ?? []) as MdtBolo[];`,
      `  const selectedBolo = (selectedBoloRaw ?? null) as MdtBolo | null;`,
      `  const boloNewType = (boloNewTypeRaw ?? "Általános") as MdtBoloType;`,
      `  const boloNewPriority = (boloNewPriorityRaw ?? "Közepes") as MdtBoloPriority;`,
      `  const boloFilterStatus = (boloFilterStatusRaw ?? "ALL") as MdtBoloStatus | "ALL";`,
      `  const boloFilterType = (boloFilterTypeRaw ?? "ALL") as MdtBoloType | "ALL";`,
      `  const boloFilterPriority = (boloFilterPriorityRaw ?? "ALL") as MdtBoloPriority | "ALL";`,
    ],
  },
};

function rewriteTab(fileBase) {
  const file = path.join(TABS_DIR, fileBase);
  const src = read(file);

  const compName = fileBase.replace(".tsx", "");
  const cfg = RENAME_SETS[compName];
  if (!cfg) throw new Error(`Nincs config ehhez: ${compName}`);

  const jsx = extractJsxReturnBlock(src);
  const vars = extractDestructureVars(src);

  // destructure újragenerálás rename-ekkel
  const lines = vars.map((v) => {
    const alias = cfg.renames[v];
    return alias ? `    ${v}: ${alias},` : `    ${v},`;
  });

  const out =
`${cfg.imports}
export default function ${compName}(props: any) {
  // Magyar komment: a tab komponens csak UI, a state/akciók a szülőből jönnek
  const {
${lines.join("\n")}
  } = props as any;

${cfg.typedLines.join("\n")}

  return (
${jsx.split("\n").map((l) => "    " + l).join("\n")}
  );
}
`;

  write(file, out);
}

function main() {
  if (!fs.existsSync(TABS_DIR)) throw new Error("Nem találom a tabs mappát: " + TABS_DIR);

  const files = [
    "DispatchTab.tsx",
    "UnitsTab.tsx",
    "ReportsTab.tsx",
    "PersonTab.tsx",
    "VehicleTab.tsx",
    "BoloTab.tsx",
  ];

  for (const f of files) rewriteTab(f);

  console.log("OK: MDT tabok javítva (implicit any + selectedUnit).");
}

main();
