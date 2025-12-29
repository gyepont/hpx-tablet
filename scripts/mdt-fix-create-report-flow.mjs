import fs from "node:fs";
import path from "node:path";

const file = path.resolve("apps/tablet-ui/src/apps/mdt/MdtApp.tsx");
let s = fs.readFileSync(file, "utf8");

const createCallIdx = s.indexOf('rpcCall("mdt:createReport"');
if (createCallIdx === -1) {
  console.error('HIBA: Nem találom: rpcCall("mdt:createReport"');
  process.exit(1);
}

const newOpenIdx = s.indexOf("setNewOpen(false);", createCallIdx);
if (newOpenIdx === -1) {
  console.error('HIBA: Nem találom: setNewOpen(false); (createReport flow-ban)');
  process.exit(1);
}

const beforeNewOpen = s.slice(Math.max(createCallIdx, newOpenIdx - 400), newOpenIdx);
const alreadyResets =
  beforeNewOpen.includes('setReportFilterType("ALL")') ||
  beforeNewOpen.includes("setReportFilterType('ALL')");

if (!alreadyResets) {
  const inject =
    'setReportQuery("");\n' +
    '    setReportFilterTag("");\n' +
    '    setReportFilterType("ALL");\n\n' +
    "    ";

  s = s.slice(0, newOpenIdx) + inject + s.slice(newOpenIdx);
}

const refreshIdx = s.indexOf("await refreshReports();", createCallIdx);
if (refreshIdx !== -1 && refreshIdx < createCallIdx + 6000) {
  const afterRefresh = s.slice(refreshIdx, refreshIdx + 250);
  const alreadyOpens = afterRefresh.includes("openReport(");

  if (!alreadyOpens) {
    const insertAfter = "await refreshReports();\n";
    const insert =
      insertAfter +
      "    try { await openReport(res.report.id); } catch {}\n";

    s =
      s.slice(0, refreshIdx) +
      s.slice(refreshIdx).replace(insertAfter, insert);
  }
}

fs.writeFileSync(file, s, "utf8");
console.log("OK: MDT report create flow javítva (filter reset + auto-open).");
