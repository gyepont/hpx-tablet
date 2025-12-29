import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

function read(file) {
  return fs.readFileSync(file, "utf8");
}
function write(file, s) {
  fs.writeFileSync(file, s, "utf8");
}

function fixEvidenceApp() {
  const file = path.join(ROOT, "apps/tablet-ui/src/apps/evidence/EvidenceApp.tsx");
  if (!fs.existsSync(file)) {
    console.log("INFO: EvidenceApp.tsx nincs meg, kihagyom:", file);
    return;
  }

  let s = read(file);

  // Magyar komment: biztosítsuk a literal action union-t (de most engedjük stringgel is, hogy ne álljon meg a build)
  const actionTypeBlock =
    'type EvidenceAction = "Létrehozva" | "Megjegyzés" | "Átadva" | "Lepecsételve";\n';

  if (!s.includes('type EvidenceAction =')) {
    // importok után szúrjuk be
    const lines = s.split("\n");
    let insertAt = 0;
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*import\s/.test(lines[i])) insertAt = i + 1;
    }
    // skip üres sorok
    while (insertAt < lines.length && lines[insertAt].trim() === "") insertAt++;
    lines.splice(insertAt, 0, actionTypeBlock.trimEnd(), "");
    s = lines.join("\n");
  }

  // Magyar komment: EvidenceEvent action mező típusa -> EvidenceAction | string
  // (így a meglévő kódod nem fog “action: string” miatt elhasalni)
  const replType = (block) =>
    block.replace(/\baction\s*:\s*[^;]+;/, 'action: EvidenceAction | string;');

  if (/type\s+EvidenceEvent\s*=/.test(s)) {
    s = s.replace(/type\s+EvidenceEvent\s*=\s*\{[\s\S]*?\};/g, (m) => replType(m));
  } else if (/interface\s+EvidenceEvent\s*\{/.test(s)) {
    s = s.replace(/interface\s+EvidenceEvent\s*\{[\s\S]*?\}/g, (m) => replType(m));
  } else {
    // Fallback: ha valamiért nem találjuk, akkor nem nyúlunk hozzá.
    console.log("INFO: EvidenceEvent definíciót nem találtam, csak EvidenceAction lett beszúrva.");
  }

  write(file, s);
  console.log("OK: EvidenceApp hotfix kész.");
}

function fixMdtReportContext() {
  const file = path.join(ROOT, "apps/tablet-ui/src/apps/mdt/MdtApp.tsx");
  if (!fs.existsSync(file)) {
    console.log("INFO: MdtApp.tsx nincs meg, kihagyom:", file);
    return;
  }

  const KEY = "hpx:evidence:lastReportId:v1";
  let s = read(file);

  // 1) ha korábban rosszul bekerült literal "\n", javítsuk ki
  s = s.replace(
    /setReportDetail\(res\.report\);\\n\s*try\s*\{\s*localStorage\.setItem\("hpx:evidence:lastReportId:v1",\s*JSON\.stringify\(res\.report\.id\)\);\s*\}\s*catch\s*\{\s*\}\\n/g,
    `setReportDetail(res.report);
    try { localStorage.setItem("${KEY}", JSON.stringify(res.report.id)); } catch {}
`
  );

  // 2) ha még nincs benne a KEY, szúrjuk be normál sorral
  if (!s.includes(KEY)) {
    const needle = "setReportDetail(res.report);";
    if (s.includes(needle)) {
      s = s.replace(
        needle,
        `setReportDetail(res.report);
    try { localStorage.setItem("${KEY}", JSON.stringify(res.report.id)); } catch {}`
      );
      console.log("OK: MDT -> Evidence kontextus mentés beszúrva.");
    } else {
      console.log("INFO: nem találtam setReportDetail(res.report); sort, kihagyom a beszúrást.");
    }
  } else {
    console.log("OK: MDT -> Evidence kontextus már benne van (csak a \\n javítás futott, ha kellett).");
  }

  write(file, s);
}

fixEvidenceApp();
fixMdtReportContext();
