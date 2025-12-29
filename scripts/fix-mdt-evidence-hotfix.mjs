import fs from "node:fs";
import path from "node:path";

const file = path.resolve(process.cwd(), "apps/tablet-ui/src/apps/mdt/MdtApp.tsx");

if (!fs.existsSync(file)) {
  console.error("HIBA: nem találom:", file);
  process.exit(1);
}

let s = fs.readFileSync(file, "utf8");
const before = s;

// 1) konkrét: rosszul beillesztett \n tokenek javítása a setReportDetail körül
s = s.replace(
  /setReportDetail\\(res\\.report\\);\\\\n\\s*try\\s*\\{\\s*localStorage\\.setItem\\("hpx:evidence:lastReportId:v1",[\\s\\S]*?\\}\\s*catch\\s*\\{\\s*\\}\\\\n?/g,
  'setReportDetail(res.report);\\n    try { localStorage.setItem("hpx:evidence:lastReportId:v1", JSON.stringify(res.report.id)); } catch {}\\n'
);

// ha csak simán ott maradt a \n (más formában)
s = s.replace(/setReportDetail\\(res\\.report\\);\\s*\\\\n\\s*/g, "setReportDetail(res.report);\\n");

// 2) törött “====” kommentek kiszedése (ne legyen több ilyen)
s = s.replace(/\\{\\s*\\/\\*\\s*={2,}[\\s\\S]*?\\*\\/\\s*\\}/g, "");
s = s.replace(/\\/\\*\\s*={2,}[\\s\\S]*?\\*\\/\\s*\\}/g, "");

// 3) openReport: lastReportId mentés (ha hiányzik)
if (!s.includes('hpx:evidence:lastReportId:v1')) {
  s = s.replace(
    /setReportDetail\\(res\\.report\\);\\s*\\n/,
    'setReportDetail(res.report);\\n    try { localStorage.setItem("hpx:evidence:lastReportId:v1", JSON.stringify(res.report.id)); } catch {}\\n'
  );
}

// 4) Tab union: “Bizonyíték” hozzáadása
s = s.replace(/type Tab = ([^;]+);/m, (m, union) => {
  if (union.includes("Bizonyíték")) return m;
  return `type Tab = ${union} | "Bizonyíték";`;
});

// 5) Bal menü lista bővítése (ha ilyen formában van benne)
s = s.replace(
  /\(\["Dispatch", "Egységek", "Jelentések", "Személy", "Jármű", "BOLO"\] as Tab\[\]\)/g,
  '(["Dispatch", "Egységek", "Jelentések", "Személy", "Jármű", "BOLO", "Bizonyíték"] as Tab[])'
);

// 6) “Bizonyíték” tab render beszúrása a BOLO elé (ha még nincs)
if (!s.includes('tab === "Bizonyíték"')) {
  s = s.replace(
    /\{tab === "BOLO" && \(\n/g,
`{tab === "Bizonyíték" && (() => {
          let lastReportId: string | null = null;
          try {
            const raw = localStorage.getItem("hpx:evidence:lastReportId:v1");
            lastReportId = raw ? (JSON.parse(raw) as string) : null;
          } catch {}
          return (
            <div style={{ opacity: 0.85 }}>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>Bizonyítékok</div>
              <div style={{ opacity: 0.75, fontSize: 13 }}>
                Utolsó megnyitott jelentés: <b>{lastReportId ?? "—"}</b>
              </div>
              <div style={{ marginTop: 10, opacity: 0.75, fontSize: 13 }}>
                MVP: itt lesz a bizonyíték lista + láncolat + reporthoz kötés. Inventory integráció később.
              </div>
            </div>
          );
        })()}

{tab === "BOLO" && (
`
  );
}

// 7) allowDrop: ha csak deklarálva van, de sehol nem használod → töröljük
const allowDropCount = (s.match(/\\ballowDrop\\b/g) ?? []).length;
if (allowDropCount === 1) {
  s = s.replace(/\\n\\s*function allowDrop\\([^\\)]*\\)\\s*\\{[\\s\\S]*?\\n\\s*\\}\\n/g, "\\n");
}

if (s === before) {
  console.log("OK: nem kellett módosítani (már rendben volt).");
} else {
  fs.writeFileSync(file, s);
  console.log("OK: MdtApp.tsx hotfix + Bizonyíték tab kész.");
}
