import fs from "node:fs";
import path from "node:path";

function findBlockEnd(src, openBraceIdx) {
  let depth = 0;
  for (let i = openBraceIdx; i < src.length; i++) {
    const ch = src[i];
    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

function replaceAsyncFunction(src, fnName, newText) {
  const start = src.indexOf(`async function ${fnName}`);
  if (start === -1) throw new Error(`Nem találom: async function ${fnName}`);
  const brace = src.indexOf("{", start);
  if (brace === -1) throw new Error(`Nem találom a { kezdetet ennél: ${fnName}`);
  const end = findBlockEnd(src, brace);
  if (end === -1) throw new Error(`Nem találtam a függvény végét: ${fnName}`);
  return src.slice(0, start) + newText + src.slice(end);
}

const mdtFile = path.resolve("apps/tablet-ui/src/apps/mdt/MdtApp.tsx");
let mdt = fs.readFileSync(mdtFile, "utf8");

// Magyar komment: ha valami korábban literal "\n"-t írt a kódba, ezt normalizáljuk
mdt = mdt.replaceAll("\\n", "\n");

// Magyar komment: csak akkor töröljük a filtereket, ha léteznek ezek a state setterek
const hasSetReportQuery = mdt.includes("setReportQuery(");
const hasSetReportFilterTag = mdt.includes("setReportFilterTag(");
const hasSetReportFilterType = mdt.includes("setReportFilterType(");

const clearFilterLines = [
  hasSetReportQuery ? '    setReportQuery("");' : null,
  hasSetReportFilterTag ? '    setReportFilterTag("");' : null,
  hasSetReportFilterType ? '    setReportFilterType("ALL");' : null,
].filter(Boolean).join("\n");

const createReportFn = `async function createReport(payload: {
    type: MdtReportType;
    title: string;
    location: string;
    tags: string[];
    involved: MdtReportInvolved[];
    vehicles: string[];
  }): Promise<void> {
    const title = (payload.title ?? "").trim();
    if (!title) {
      notify("Jelentések", "A cím kötelező.", "warning");
      return;
    }

    try {
      const req = {
        type: payload.type,
        title,
        location: (payload.location ?? "—").trim() || "—",
        tags: payload.tags ?? [],
        involved: payload.involved ?? [],
        vehicles: payload.vehicles ?? [],
        fullText: "<p></p>",
        actorCid,
        actorName,
      };

      const res = await rpcCall("mdt:createReport", req as any, { timeoutMs: 4000 });

      // Magyar komment: UI reset
      setNewOpen(false);
      setNewTitle("");
      setNewLocation("");
      setNewTags([]);

${clearFilterLines ? clearFilterLines + "\n" : ""}      await refreshReports();

      if (res?.report?.id) {
        await openReport(res.report.id);
        notify("Jelentések", "Jelentés létrehozva.", "success");
      } else {
        notify("Jelentések", "Hiba: a createReport nem adott vissza report.id-t.", "error");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      notify("Jelentések", "Hiba: " + msg, "error");
    }
  }
`;

mdt = replaceAsyncFunction(mdt, "createReport", createReportFn);
fs.writeFileSync(mdtFile, mdt, "utf8");
console.log("OK: MdtApp.tsx createReport javítva.");

// Magyar komment: mock oldalon is legyen safe default (ne dőljön el undefined tags/involved/vehicles miatt)
const mockFile = path.resolve("apps/tablet-ui/src/core/rpc/transports/mock.ts");
let mock = fs.readFileSync(mockFile, "utf8");

mock = mock.replace(/normalizeTagList\(\s*([A-Za-z_$][\w$]*)\.tags\s*\)/g, "normalizeTagList($1.tags ?? [])");
mock = mock.replace(/normalizeInvolved\(\s*([A-Za-z_$][\w$]*)\.involved\s*\)/g, "normalizeInvolved($1.involved ?? [])");
mock = mock.replace(/normalizeVehicles\(\s*([A-Za-z_$][\w$]*)\.vehicles\s*\)/g, "normalizeVehicles($1.vehicles ?? [])");

fs.writeFileSync(mockFile, mock, "utf8");
console.log("OK: mock.ts defaultok javítva (tags/involved/vehicles).");
