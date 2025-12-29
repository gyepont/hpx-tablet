import fs from "node:fs";
import path from "node:path";

const FILE = path.resolve("apps/tablet-ui/src/apps/mdt/MdtApp.tsx");
const KEY = "hpx:evidence:lastReportId:v1";

if (!fs.existsSync(FILE)) {
  console.error("HIBA: nem találom:", FILE);
  process.exit(1);
}

let s = fs.readFileSync(FILE, "utf8");

// Magyar komment: ha korábbi hibából szó szerinti \n maradt a kódban, ezt a konkrét mintát javítjuk
s = s.replaceAll(
  'setReportDetail(res.report);\\n    try { localStorage.setItem("hpx:evidence:lastReportId:v1", JSON.stringify(res.report.id)); } catch {}\\n',
  `setReportDetail(res.report);
    try { localStorage.setItem("${KEY}", JSON.stringify(res.report.id)); } catch {}
`
);

// Magyar komment: ha már benne van a localStorage set, nem nyúlunk hozzá
if (s.includes(`localStorage.setItem("${KEY}"`)) {
  fs.writeFileSync(FILE, s, "utf8");
  console.log("OK: már volt Evidence kontextus mentés (csak az esetleges \\\\n szemetet javítottam).");
  process.exit(0);
}

// Magyar komment: beszúrjuk közvetlenül a report megnyitás után
const re = /(^[ \t]*)setReportDetail\(res\.report\);\s*$/m;
const m = s.match(re);

if (!m) {
  console.error('HIBA: nem találom a beszúrási pontot: setReportDetail(res.report);');
  process.exit(1);
}

const indent = m[1] ?? "";
s = s.replace(
  re,
  `${indent}setReportDetail(res.report);\n${indent}try { localStorage.setItem("${KEY}", JSON.stringify(res.report.id)); } catch {}`
);

fs.writeFileSync(FILE, s, "utf8");
console.log("OK: MDT -> Evidence kontextus mentés beépítve.");
