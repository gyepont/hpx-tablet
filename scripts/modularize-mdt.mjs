/**
 * Magyar komment: MDT modularizáló – a jelenlegi, működő MdtApp.tsx-ből tabokra szedés.
 * - Kiveszi a nagy JSX blokkokat és külön tab komponensekbe teszi (tabs/*)
 * - Az MdtApp.tsx layout + state/akciók marad
 *
 * Futtatás:
 *   node scripts/modularize-mdt.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "apps", "tablet-ui", "src", "apps", "mdt", "MdtApp.tsx");
const OUT_DIR = path.join(ROOT, "apps", "tablet-ui", "src", "apps", "mdt", "tabs");

function die(msg) {
  console.error(msg);
  process.exit(1);
}

function readFile(p) {
  return fs.readFileSync(p, "utf8");
}

function writeFile(p, content) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, "utf8");
}

function findAllMarkers(src) {
  // Magyar komment: a backupos MdtApp.tsx-ben ezek a kommentek vannak: /* ===== Dispatch ===== */} majd {tab === "Dispatch" && (
  const re = /\/\*\s*=====\s*([^*]+?)\s*=====\s*\*\/\}\s*\n\s*\{tab === "([^"]+)" && \(\s*\n/g;
  const markers = [];
  let m;
  while ((m = re.exec(src)) !== null) {
    markers.push({ label: m[1].trim(), tab: m[2].trim(), idx: m.index });
  }
  return markers;
}

function extractInnerBlock(section) {
  const i = section.indexOf("&& (");
  if (i === -1) return null;
  const j = section.indexOf("<", i);
  const k = section.lastIndexOf(")}");
  if (j === -1 || k === -1 || k <= j) return null;
  return section.slice(j, k).trimEnd();
}

function removeTypeFromImport(typeImportBlock, typeName) {
  const re = new RegExp(`\\n\\s*${typeName},?\\s*`, "g");
  return typeImportBlock.replace(re, "\n");
}

function makeTabComponent(name, inner, destructureList, extras) {
  const { imports = "", typeImports = "" } = extras || {};
  const destr = destructureList.map((x) => `    ${x},`).join("\n");
  return `${imports}${typeImports}export default function ${name}(props: any) {
  // Magyar komment: a tab komponens csak UI, a state/akciók a szülőből jönnek
  const {
${destr}
  } = props as any;

  return (
    ${inner}
  );
}
`;
}

function usedFrom(inner, candidates) {
  return candidates.filter((c) => inner.includes(c));
}

// Magyar komment: biztonságos változó lista (csak amit a tabok tényleg használnak)
const CAND = {
  Dispatch: [
    "calls","selectedUnit","selectedUnitId","selectedCallId","selectedCall",
    "setSelectedCallId","setDispatchReportDraft","dispatchReportDraft",
    "unitById","acceptCall","openReport","setTab","setWaypoint",
    "updateCallStatus","addNote","closeCall","hhmmss","getCallAccent"
  ],
  Units: [
    "officers","units","unitById","officerByCid","selectedUnitId","setSelectedUnitId",
    "onOfficerDragStart","allowDrop","onUnitDrop","setUnitStatus"
  ],
  Reports: [
    "newOpen","newType","setNewType","newTitle","setNewTitle","newLocation","setNewLocation","newTags","toggleNewTag",
    "createReport","tagCatalog","REPORT_TYPES","INVOLVED_ROLES","canManageTags","tagInput","setTagInput",
    "addTagToCatalog","saveTagCatalog","removeTagFromCatalog",
    "reportQuery","setReportQuery","reportFilterType","setReportFilterType","reportFilterTag","setReportFilterTag","refreshReports",
    "reports","selectedReportId","openReport","reportDetail","setReportDetail","reportSaving","isReportLocked","toggleReportTag",
    "addInvolvedCid","setAddInvolvedCid","addInvolvedRole","setAddInvolvedRole","addInvolvedFromInput",
    "updateInvolvedRole","removeInvolved",
    "addVehiclePlate","setAddVehiclePlate","addVehicleToReport","removeVehicleFromReport",
    "saveReport","submitReport","fmtDate"
  ],
  Person: [
    "personQuery","setPersonQuery","searchPerson","personResults","openPerson","selectedPerson","personLinkedReports","createReportForPerson","setTab","openReport"
  ],
  Vehicle: [
    "vehicleQuery","setVehicleQuery","searchVehicle","vehicleResults","openVehicle","selectedVehicle","vehicleLinkedReports","createReportForVehicle","setTab","openReport"
  ],
  BOLO: [
    "boloNewOpen","BOLO_TYPES","BOLO_PRIORITIES","BOLO_STATUSES",
    "boloNewType","setBoloNewType","boloNewPriority","setBoloNewPriority","boloNewTitle","setBoloNewTitle","boloNewDesc","setBoloNewDesc",
    "boloNewTags","toggleBoloNewTag","tagCatalog",
    "boloNewPeopleCsv","setBoloNewPeopleCsv","boloNewVehiclesCsv","setBoloNewVehiclesCsv","boloNewReportsCsv","setBoloNewReportsCsv",
    "boloNewExpiresMin","setBoloNewExpiresMin","createBolo",
    "boloQuery","setBoloQuery","boloFilterStatus","setBoloFilterStatus","boloFilterType","setBoloFilterType","boloFilterPriority","setBoloFilterPriority",
    "refreshBolos","bolos","selectedBoloId","openBolo","selectedBolo",
    "updateBoloStatus","markBoloSighting","boloSightingNote","setBoloSightingNote",
    "setTab","openPerson","openVehicle","fmtDate","boloPriorityDot"
  ],
};

function main() {
  if (!fs.existsSync(SRC)) die(`HIBA: nem találom: ${SRC}`);

  const src = readFile(SRC);

  const typeImportMatch = src.match(/import type \{[\s\S]*?\} from "\.\.\/\.\.\/core\/mdt\/types";\n/);
  if (!typeImportMatch) die("HIBA: nem találtam a type import blokkot a core/mdt/types-ből.");

  const typeImportBlock = typeImportMatch[0];
  const typeImportStart = src.indexOf(typeImportBlock);
  const typeImportEnd = typeImportStart + typeImportBlock.length;

  // Header (a type import végéig)
  const header = src.slice(0, typeImportEnd);

  // Magyar komment: ReportEditor importot kivesszük MdtApp-ból (ReportsTab fogja importálni)
  const headerNoEditor = header.replace(/\nimport ReportEditor from "\.\/ReportEditor";\n/, "\n");

  // Magyar komment: timeline-only típusok a tabokba kerülnek
  let fixedTypeImport = typeImportBlock;
  fixedTypeImport = removeTypeFromImport(fixedTypeImport, "MdtBoloTimelineItem");
  fixedTypeImport = removeTypeFromImport(fixedTypeImport, "MdtReportTimelineItem");

  const headerFixed = headerNoEditor.replace(typeImportBlock, fixedTypeImport);

  // Tab importok beszúrása a usePlayerContext import után
  const insertAfter = 'import { usePlayerContext } from "../../core/session/usePlayerContext";\n';
  if (!headerFixed.includes(insertAfter)) die("HIBA: nem találtam a usePlayerContext import sort.");

  const tabImports =
`\n// Magyar komment: MDT tab UI komponensek\n` +
`import DispatchTab from "./tabs/DispatchTab";\n` +
`import UnitsTab from "./tabs/UnitsTab";\n` +
`import ReportsTab from "./tabs/ReportsTab";\n` +
`import PersonTab from "./tabs/PersonTab";\n` +
`import VehicleTab from "./tabs/VehicleTab";\n` +
`import BoloTab from "./tabs/BoloTab";\n\n`;

  const headerWithTabs = headerFixed.replace(insertAfter, insertAfter + tabImports);

  // return start
  const returnMatch = src.match(/\n\s*return\s*\(\s*\n/);
  if (!returnMatch) die("HIBA: nem találtam a return( blokkot.");
  const returnStart = src.indexOf(returnMatch[0]);

  const bodyBeforeReturn = src.slice(typeImportEnd, returnStart);

  // markers
  const markers = findAllMarkers(src);
  if (!markers.length) die("HIBA: nem találtam tab marker kommenteket (/* ===== X ===== */}).");

  const endReturn = src.lastIndexOf("\n  );");
  if (endReturn === -1) die("HIBA: nem találtam a return zárását (\\n  );).");

  // prefix (layout + header) a return-től az első markerig
  let prefix = src.slice(returnStart, markers[0].idx).trimEnd();
  if (prefix.endsWith("{")) prefix = prefix.slice(0, -1).trimEnd();

  // kivágjuk a tab blokkokat
  const markerMap = {};
  for (let i = 0; i < markers.length; i++) {
    const start = markers[i].idx;
    const end = (i + 1 < markers.length) ? markers[i + 1].idx : endReturn;
    const section = src.slice(start, end);
    const inner = extractInnerBlock(section);
    if (!inner) die(`HIBA: nem tudtam kivágni a(z) ${markers[i].label}/${markers[i].tab} blokkot.`);
    markerMap[markers[i].label] = inner;
  }

  // tab fájlok
  writeFile(path.join(OUT_DIR, "DispatchTab.tsx"), makeTabComponent("DispatchTab", markerMap["Dispatch"], usedFrom(markerMap["Dispatch"], CAND.Dispatch), {}));
  writeFile(path.join(OUT_DIR, "UnitsTab.tsx"), makeTabComponent("UnitsTab", markerMap["Units"], usedFrom(markerMap["Units"], CAND.Units), {}));

  // Reports tab extra importokkal
  const reportsExtras = {
    imports: 'import ReportEditor from "../ReportEditor";\n',
    typeImports: 'import type { MdtReportTimelineItem } from "../../../core/mdt/types";\n\n',
  };
  writeFile(path.join(OUT_DIR, "ReportsTab.tsx"), makeTabComponent("ReportsTab", markerMap["Reports"], usedFrom(markerMap["Reports"], CAND.Reports), reportsExtras));

  writeFile(path.join(OUT_DIR, "PersonTab.tsx"), makeTabComponent("PersonTab", markerMap["Person"], usedFrom(markerMap["Person"], CAND.Person), {}));
  writeFile(path.join(OUT_DIR, "VehicleTab.tsx"), makeTabComponent("VehicleTab", markerMap["Vehicle"], usedFrom(markerMap["Vehicle"], CAND.Vehicle), {}));

  // BOLO tab timeline type importtal
  const boloExtras = {
    typeImports: 'import type { MdtBoloTimelineItem } from "../../../core/mdt/types";\n\n',
  };
  writeFile(path.join(OUT_DIR, "BoloTab.tsx"), makeTabComponent("BoloTab", markerMap["BOLO"], usedFrom(markerMap["BOLO"], CAND.BOLO), boloExtras));

  // új MdtApp return: tab render
  const usedLists = {
    Dispatch: usedFrom(markerMap["Dispatch"], CAND.Dispatch),
    Units: usedFrom(markerMap["Units"], CAND.Units),
    Reports: usedFrom(markerMap["Reports"], CAND.Reports),
    Person: usedFrom(markerMap["Person"], CAND.Person),
    Vehicle: usedFrom(markerMap["Vehicle"], CAND.Vehicle),
    BOLO: usedFrom(markerMap["BOLO"], CAND.BOLO),
  };

  function spread(list) {
    return `{...{${list.join(", ")}}}`;
  }

  const tabRenders =
`
        {tab === "Dispatch" && <DispatchTab ${spread(usedLists.Dispatch)} />}
        {tab === "Egységek" && <UnitsTab ${spread(usedLists.Units)} />}
        {tab === "Jelentések" && <ReportsTab ${spread(usedLists.Reports)} />}
        {tab === "Személy" && <PersonTab ${spread(usedLists.Person)} />}
        {tab === "Jármű" && <VehicleTab ${spread(usedLists.Vehicle)} />}
        {tab === "BOLO" && <BoloTab ${spread(usedLists.BOLO)} />}
`;

  const newReturn =
`${prefix}
${tabRenders}
      </div>
    </div>
  );
}
`;

  const newMdtApp = headerWithTabs + bodyBeforeReturn + newReturn;
  writeFile(SRC, newMdtApp);

  console.log("OK: MDT modularizálás kész.");
  console.log("- Tabok: apps/tablet-ui/src/apps/mdt/tabs/*.tsx");
  console.log("- MdtApp.tsx: layout + state/akciók (UI tabok kiszervezve)");
}

main();
