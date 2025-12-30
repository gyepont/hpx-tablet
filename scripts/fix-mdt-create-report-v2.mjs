import fs from "node:fs";
import path from "node:path";

function findClosingParen(src, openParenIdx) {
  let depth = 0;
  let inStr = null;
  let esc = false;

  for (let i = openParenIdx; i < src.length; i++) {
    const ch = src[i];

    if (inStr) {
      if (esc) { esc = false; continue; }
      if (ch === "\\") { esc = true; continue; }
      if (ch === inStr) { inStr = null; continue; }
      continue;
    }

    if (ch === "'" || ch === '"' || ch === "`") { inStr = ch; continue; }

    if (ch === "(") depth++;
    if (ch === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function findMatchingBrace(src, openBraceIdx) {
  let depth = 0;
  let inStr = null;
  let esc = false;

  for (let i = openBraceIdx; i < src.length; i++) {
    const ch = src[i];

    if (inStr) {
      if (esc) { esc = false; continue; }
      if (ch === "\\") { esc = true; continue; }
      if (ch === inStr) { inStr = null; continue; }
      continue;
    }

    if (ch === "'" || ch === '"' || ch === "`") { inStr = ch; continue; }

    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function replaceFunction(src, fnName, newFnText) {
  const start = src.indexOf(`async function ${fnName}`);
  if (start === -1) throw new Error(`Nem találom: async function ${fnName}`);

  const openParen = src.indexOf("(", start);
  if (openParen === -1) throw new Error(`Nem találom a ( jelet: ${fnName}`);

  const closeParen = findClosingParen(src, openParen);
  if (closeParen === -1) throw new Error(`Nem találom a ) végét: ${fnName}`);

  const bodyOpen = src.indexOf("{", closeParen);
  if (bodyOpen === -1) throw new Error(`Nem találom a body { kezdetét: ${fnName}`);

  const bodyClose = findMatchingBrace(src, bodyOpen);
  if (bodyClose === -1) throw new Error(`Nem találom a body } végét: ${fnName}`);

  const end = bodyClose + 1;
  return src.slice(0, start) + newFnText + src.slice(end);
}

const mdtFile = path.resolve("apps/tablet-ui/src/apps/mdt/MdtApp.tsx");
let mdt = fs.readFileSync(mdtFile, "utf8");

const newCreateReport = `async function createReport(payload: {
    type: MdtReportType;
    title: string;
    location: string;
    tags?: string[];
    involved?: MdtReportInvolved[];
    vehicles?: string[];
  }): Promise<void> {
    const title = (payload.title ?? "").trim();
    if (!title) {
      notify("Jelentések", "A cím kötelező.", "warning");
      return;
    }

    try {
      const res = await rpcCall(
        "mdt:createReport",
        {
          type: payload.type,
          title,
          location: (payload.location ?? "—").trim() || "—",
          tags: payload.tags ?? [],
          involved: payload.involved ?? [],
          vehicles: payload.vehicles ?? [],
          fullText: "<p></p>",
          actorCid,
          actorName,
        } as any,
        { timeoutMs: 4000 }
      );

      setNewOpen(false);
      setNewTitle("");
      setNewLocation("");
      setNewTags([]);

      await refreshReports();

      if (res?.report?.id) {
        await openReport(res.report.id);
        notify("Jelentések", "Jelentés létrehozva.", "success");
      } else {
        notify("Jelentések", "Hiba: nincs report.id a válaszban.", "error");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      notify("Jelentések", "Hiba: " + msg, "error");
    }
  }
`;

mdt = replaceFunction(mdt, "createReport", newCreateReport);
fs.writeFileSync(mdtFile, mdt, "utf8");
console.log("OK: createReport javítva (v2).");

// Mock oldalon védekezés, ha valahol nincs tömb (ne dőljön el)
const mockFile = path.resolve("apps/tablet-ui/src/core/rpc/transports/mock.ts");
let mock = fs.readFileSync(mockFile, "utf8");
mock = mock.replaceAll("normalizeTagList(p.tags)", "normalizeTagList(p.tags ?? [])");
mock = mock.replaceAll("normalizeInvolved(p.involved)", "normalizeInvolved(p.involved ?? [])");
mock = mock.replaceAll("normalizeVehicles(p.vehicles)", "normalizeVehicles(p.vehicles ?? [])");
fs.writeFileSync(mockFile, mock, "utf8");
console.log("OK: mock defaultok beállítva (tags/involved/vehicles).");
