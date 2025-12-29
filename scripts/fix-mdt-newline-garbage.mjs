import fs from "node:fs";

const FILE = "apps/tablet-ui/src/apps/mdt/MdtApp.tsx";

let s = fs.readFileSync(FILE, "utf8");
const before = s;

function repAll(from, to) {
  if (!s.includes(from)) return 0;
  const parts = s.split(from);
  s = parts.join(to);
  return parts.length - 1;
}

// Magyar komment: a konkrét hibás sor (szó szerint \n volt a TS kódban)
repAll(
  'setReportDetail(res.report);\\n    try { localStorage.setItem("hpx:evidence:lastReportId:v1", JSON.stringify(res.report.id)); } catch {}\\n',
  `setReportDetail(res.report);
    try { localStorage.setItem("hpx:evidence:lastReportId:v1", JSON.stringify(res.report.id)); } catch {}
`
);

// Magyar komment: ha több helyen is előfordul, akkor legalább ezt a két mintát javítjuk
repAll("setReportDetail(res.report);\\n", "setReportDetail(res.report);\n");
repAll("} catch {}\\n", "} catch {}\n");

// Magyar komment: ha az allowDrop csak deklarálva van és sehol nem hivatkozod, töröljük
const allowDropCount = (s.match(/\ballowDrop\b/g) ?? []).length;
if (allowDropCount === 1) {
  s = s.replace(/\n\s*function allowDrop\([^\)]*\)\s*\{[\s\S]*?\n\s*\}\n/g, "\n");
}

if (s === before) {
  console.log("OK: nem találtam javítandó \\n szemetet ebben a fájlban.");
} else {
  fs.writeFileSync(FILE, s);
  console.log("OK: \\n szemét javítva MdtApp.tsx-ben.");
}
