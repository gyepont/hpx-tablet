import fs from "node:fs";
import path from "node:path";

const SRC = path.resolve("apps/tablet-ui/src/apps/mdt/MdtApp.tsx");

function mustFind(haystack, needle) {
  const idx = haystack.indexOf(needle);
  if (idx === -1) throw new Error(`Nem találom a mintát: ${needle}`);
  return idx;
}

function insertImports(src) {
  if (src.includes('from "./tabs/DispatchTab"') || src.includes('from "./tabs/UnitsTab"')) return src;

  const marker = "\n\ntype Tab =";
  const idx = mustFind(src, marker);

  const imports = [
    "",
    'import DispatchTab from "./tabs/DispatchTab";',
    'import UnitsTab from "./tabs/UnitsTab";',
    "",
  ].join("\n");

  return src.slice(0, idx) + imports + src.slice(idx);
}

function replaceSection(src, startNeedle, endNeedle, replacement) {
  const start = mustFind(src, startNeedle);
  const end = mustFind(src, endNeedle);
  if (end <= start) throw new Error("Hibás marker sorrend: " + startNeedle + " -> " + endNeedle);
  return src.slice(0, start) + replacement + src.slice(end);
}

function main() {
  let src = fs.readFileSync(SRC, "utf8");

  src = insertImports(src);

  const dispatchMarker = "/* ===== Dispatch ===== */";
  const unitsMarker = "/* ===== Units ===== */";
  const reportsMarker = "/* ===== Reports ===== */";

  const dispatchReplacement = [
    "        {/* ===== Dispatch ===== */}",
    '        {tab === "Dispatch" && (',
    "          <DispatchTab",
    "            calls={calls}",
    "            unitById={unitById}",
    "            selectedUnit={selectedUnit}",
    "            selectedUnitId={selectedUnitId}",
    "            selectedCallId={selectedCallId}",
    "            setSelectedCallId={setSelectedCallId}",
    "            selectedCall={selectedCall}",
    "            dispatchReportDraft={dispatchReportDraft}",
    "            setDispatchReportDraft={setDispatchReportDraft}",
    "            acceptCall={acceptCall}",
    "            setWaypoint={setWaypoint}",
    "            updateCallStatus={updateCallStatus}",
    "            addNote={addNote}",
    "            closeCall={closeCall}",
    "            hhmmss={hhmmss}",
    "            getCallAccent={getCallAccent}",
    "          />",
    "        )}",
    "",
  ].join("\n");

  src = replaceSection(src, dispatchMarker, unitsMarker, dispatchReplacement);

  const unitsReplacement = [
    "        {/* ===== Units ===== */}",
    '        {tab === "Egységek" && (',
    "          <UnitsTab",
    "            officers={officers}",
    "            units={units}",
    "            unitById={unitById}",
    "            officerByCid={officerByCid}",
    "            selectedUnitId={selectedUnitId}",
    "            setSelectedUnitId={setSelectedUnitId}",
    "            selectedUnit={selectedUnit}",
    "            onOfficerDragStart={onOfficerDragStart}",
    "            onUnitDrop={onUnitDrop}",
    "            setUnitStatus={setUnitStatus}",
    "          />",
    "        )}",
    "",
  ].join("\n");

  src = replaceSection(src, unitsMarker, reportsMarker, unitsReplacement);

  fs.writeFileSync(SRC, src, "utf8");
  console.log("OK: MdtApp.tsx frissítve (Dispatch + Egységek tab kiszervezve).");
}

main();
