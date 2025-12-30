import fs from "node:fs";
import path from "node:path";

const FILE = path.resolve("apps/tablet-ui/src/apps/cases/CasesApp.tsx");
const OPEN_CASE_KEY = 'const OPEN_CASE_KEY = "hpx:cases:openCaseId:v1";';

if (!fs.existsSync(FILE)) {
  console.error("HIBA: nem találom:", FILE);
  process.exit(1);
}

let s = fs.readFileSync(FILE, "utf8");

if (!s.includes(OPEN_CASE_KEY)) {
  const anchor = 'const OPEN_REPORT_KEY = "hpx:mdt:openReportId:v1";';
  const idx = s.indexOf(anchor);
  if (idx === -1) {
    console.error("HIBA: nem találom az anchor sort a CasesApp-ban:", anchor);
    process.exit(1);
  }
  s =
    s.slice(0, idx + anchor.length) +
    "\n" +
    OPEN_CASE_KEY +
    "\n" +
    s.slice(idx + anchor.length);
}

const hookAnchor = "}, [selectedSaved, dirty]);";
if (!s.includes(hookAnchor)) {
  console.error("HIBA: nem találom a beszúrási pontot (selectedSaved/dirty useEffect vége).");
  process.exit(1);
}

if (!s.includes("localStorage.getItem(OPEN_CASE_KEY)")) {
  const inject = `
  useEffect(() => {
    if (dirty) return;

    try {
      const raw = localStorage.getItem(OPEN_CASE_KEY);
      if (!raw) return;

      localStorage.removeItem(OPEN_CASE_KEY);

      const id = String(JSON.parse(raw) ?? "").trim();
      if (!id) return;

      if (items.some((x) => x.id === id)) {
        setSelectedId(id);
      } else {
        // Magyar komment: ha nincs ilyen ID, akkor legalább keressen rá
        setSearch(id);
      }
    } catch {
      // no-op
    }
  }, [items, dirty]);
`;

  s = s.replace(hookAnchor, hookAnchor + inject);
}

fs.writeFileSync(FILE, s, "utf8");
console.log("OK: CasesApp openCaseId támogatás beépítve.");
