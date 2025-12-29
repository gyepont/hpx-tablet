import fs from "node:fs";
import path from "node:path";

const file = path.resolve("apps/tablet-ui/src/apps/mdt/MdtApp.tsx");
let s = fs.readFileSync(file, "utf8");

// Magyar komment: minden block comment törlése (JS + JSX), mert csak bajt csinál
s = s.replace(/\/\*[\s\S]*?\*\//g, "");

// Magyar komment: elrontott dupla kapcsos " { { " javítása (de a style={{}} maradjon)
s = s.replace(/(?<![=])\{\s*\{/g, "{");

// Magyar komment: ha az allowDrop csak deklarálva van, de sehol sincs használva, töröljük
const allowDropHits = (s.match(/\ballowDrop\b/g) ?? []).length;
if (allowDropHits === 1) {
  s = s.replace(/\n\s*function\s+allowDrop\s*\([^)]*\)\s*\{\s*[\s\S]*?\n\s*\}\s*\n/g, "\n");
}

fs.writeFileSync(file, s, "utf8");
console.log("OK: MdtApp.tsx hotfix kész (kommentek törölve + allowDrop TS6133 kezelve).");
