import fs from "node:fs";
import path from "node:path";

const FILE = path.resolve("apps/tablet-ui/src/apps/evidence/EvidenceApp.tsx");
const KEY = "hpx:evidence:lastReportId:v1";

if (!fs.existsSync(FILE)) {
  console.error("HIBA: nem találom:", FILE);
  process.exit(1);
}

let s = fs.readFileSync(FILE, "utf8");

if (!s.includes(KEY)) {
  console.log("INFO: EvidenceApp nem hivatkozik a lastReportId kulcsra. (Lehet nálad már máshogy van megoldva.)");
  console.log("INFO: Nem nyúltam a fájlhoz.");
  process.exit(0);
}

// Magyar komment: nagyon óvatos, csak egy tipikus alapérték mintát javítunk:
// linkedReportId: ""  -> linkedReportId: (lastReportId ?? "")
// Ha ilyen nincs, akkor nem csinálunk semmit.
const before = s;
s = s.replace(/linkedReportId\s*:\s*""/g, "linkedReportId: (lastReportId ?? \"\")");

if (s === before) {
  console.log("OK: nincs szükség módosításra (nincs linkedReportId: \"\" minta).");
  process.exit(0);
}

fs.writeFileSync(FILE, s, "utf8");
console.log("OK: EvidenceApp: linkedReportId default a lastReportId alapján.");
