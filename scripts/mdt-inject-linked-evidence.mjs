import fs from "node:fs";
import path from "node:path";

const FILE = path.resolve("apps/tablet-ui/src/apps/mdt/MdtApp.tsx");
let s = fs.readFileSync(FILE, "utf8");

const importLine = 'import LinkedEvidencePanel from "./components/LinkedEvidencePanel";\n';
if (!s.includes(importLine)) {
  // Magyar komment: import beszúrás ReportEditor import után, ha van
  if (s.includes('import ReportEditor')) {
    s = s.replace(/(import\s+ReportEditor[^\n]*\n)/, `$1${importLine}`);
  } else {
    // Magyar komment: fallback – legelső import blokk végére
    s = s.replace(/(\n)(\nexport\s+default|\nconst|\nfunction)/, `\n${importLine}\n$2`);
  }
}

const needle = "<ReportEditor";
if (!s.includes(needle)) {
  console.error("HIBA: nem találom a ReportEditor komponenst a MdtApp.tsx-ben.");
  process.exit(1);
}

const panel = [
  "",
  "                  <LinkedEvidencePanel",
  "                    reportId={reportDetail.id}",
  "                    disabled={reportSaving}",
  "                  />",
  ""
].join("\n");

if (!s.includes("LinkedEvidencePanel") || !s.includes("reportId={reportDetail.id}")) {
  s = s.replace(needle, panel + needle);
}

fs.writeFileSync(FILE, s, "utf8");
console.log("OK: LinkedEvidencePanel beszúrva a Jelentés szerkesztőbe.");
