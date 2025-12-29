import fs from "node:fs";
import path from "node:path";

const FILE = path.resolve("apps/tablet-ui/src/apps/mdt/MdtApp.tsx");
const KEY = "hpx:evidence:lastReportId:v1";

let s = fs.readFileSync(FILE, "utf8");

// Magyar komment: korábbi hibás beszúrás takarítása (szó szerinti \n karakterek)
s = s.replace(
  /setReportDetail\(res\.report\);\s*\\n\s*try\s*\{\s*localStorage\.setItem\("hpx:evidence:lastReportId:v1",\s*JSON\.stringify\(res\.report\.id\)\);\s*\}\s*catch\s*\{\s*\}\s*\\n/g,
  `setReportDetail(res.report);
    try { localStorage.setItem("${KEY}", JSON.stringify(res.report.id)); } catch {}
`
);

// Magyar komment: ha még nincs benne a KEY, beszúrjuk setReportDetail után
if (!s.includes(KEY)) {
  const needle = "setReportDetail(res.report);";
  const idx = s.indexOf(needle);
  if (idx === -1) {
    console.error("HIBA: nem találom a beszúrási pontot: setReportDetail(res.report);");
    process.exit(1);
  }

  // Magyar komment: megtartjuk az indentet
  const lineStart = s.lastIndexOf("\n", idx) + 1;
  const indent = s.slice(lineStart, idx).match(/^\s*/)?.[0] ?? "";

  const insert =
`${needle}
${indent}try { localStorage.setItem("${KEY}", JSON.stringify(res.report.id)); } catch {}`;

  s = s.replace(needle, insert);
}

fs.writeFileSync(FILE, s, "utf8");
console.log("OK: Evidence↔MDT link rendben (localStorage lastReportId).");
