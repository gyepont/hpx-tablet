import fs from "node:fs";
import path from "node:path";

const mockFile = path.resolve("apps/tablet-ui/src/core/rpc/transports/mock.ts");
let s = fs.readFileSync(mockFile, "utf8");

const start = s.indexOf('case "mdt:closeCall"');
if (start === -1) {
  console.log('HIBA: nem találom a mock.ts-ben: case "mdt:closeCall"');
  process.exit(1);
}

const next = s.indexOf('case "', start + 5);
const end = next === -1 ? s.length : next;

const block = s.slice(start, end);
let fixed = block;

// 1) Status átállítás: SUBMITTED -> DRAFT (csak ebben a blokkban)
fixed = fixed.replace(/status:\s*"SUBMITTED"/g, 'status: "DRAFT"');
fixed = fixed.replace(/status:\s*"SEALED"/g, 'status: "DRAFT"'); // ha véletlen így lenne elnevezve

// 2) Ha valahol "locked" flag van, azt is kikapcsoljuk (szintén csak itt)
fixed = fixed.replace(/isLocked:\s*true/g, "isLocked: false");
fixed = fixed.replace(/locked:\s*true/g, "locked: false");

// 3) Biztosítsuk: ha van report objektum, legyen rajta status DRAFT (ha eddig nem volt)
if (fixed.includes("const report") && !fixed.match(/status:\s*"/)) {
  fixed = fixed.replace(/(const\s+report\s*:\s*[^=]+=\s*\{\s*)/m, `$1\n            status: "DRAFT",\n`);
}

if (fixed === block) {
  console.log("INFO: nem találtam cserélendő status/lock mintát a closeCall blokkban.");
} else {
  s = s.slice(0, start) + fixed + s.slice(end);
  fs.writeFileSync(mockFile, s, "utf8");
  console.log("OK: mock.ts — closeCall report status -> DRAFT (nem lockol).");
}
