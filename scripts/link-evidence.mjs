import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "apps/tablet-ui/src/apps/mdt/MdtApp.tsx");
const KEY = "hpx:evidence:lastReportId:v1";

if (!fs.existsSync(SRC)) {
  console.error("HIBA: nem találom:", SRC);
  process.exit(1);
}

const original = fs.readFileSync(SRC, "utf8");

if (original.includes(KEY)) {
  console.log("OK: Evidence link már benne van (nincs teendő).");
  process.exit(0);
}

const needle = "setReportDetail(res.report);";
const insert =
  'setReportDetail(res.report);\\n' +
  `    try { localStorage.setItem("${KEY}", JSON.stringify(res.report.id)); } catch {}\\n`;

if (!original.includes(needle)) {
  console.error("HIBA: nem találom a beszúrási pontot (setReportDetail(res.report);).");
  process.exit(1);
}

const updated = original.replace(needle, insert);
fs.writeFileSync(SRC, updated, "utf8");
console.log("OK: Evidence link beírva az MDT-be.");
