import fs from "node:fs";
import path from "node:path";

const FILE = path.resolve("apps/tablet-ui/src/apps/mdt/MdtApp.tsx");
const KEY = "hpx:evidence:lastReportId:v1";

let s = fs.readFileSync(FILE, "utf8");

// Magyar komment: ha valaha szó szerint "\n" került bele (régi hiba), azt normál sortörésre javítjuk
s = s.replaceAll("setReportDetail(res.report);\\n", "setReportDetail(res.report);\n");
s = s.replaceAll("} catch {}\\n", "} catch {}\n");

// 1) Ha még nincs benne, tegyük be a report megnyitásnál a localStorage mentést
if (!s.includes(KEY)) {
  const needle = "setReportDetail(res.report);";
  if (s.includes(needle)) {
    s = s.replace(
      needle,
      `${needle}\n    try { localStorage.setItem("${KEY}", JSON.stringify(res.report.id)); } catch {}\n`
    );
  }
}

// 2) Jelentés szerkesztőbe egy kis “Bizonyítékok” panel beszúrás
const panel = `
                  <div style={{ marginTop: 12, border: "1px solid rgba(255,255,255,0.10)", padding: 10 }}>
                    <div style={{ fontWeight: 900, marginBottom: 6 }}>Bizonyítékok</div>
                    <div style={{ opacity: 0.75, fontSize: 12 }}>
                      Kontextus: ez a jelentés ID átmegy a Bizonyítékok appba: <b>{reportDetail.id}</b>
                    </div>

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
                      <button
                        className="hpx-btn"
                        onClick={() => {
                          try { localStorage.setItem("${KEY}", JSON.stringify(reportDetail.id)); } catch {}
                          window.postMessage(
                            { type: "hpx:notify", title: "Bizonyítékok", message: "Kontextus beállítva. Nyisd meg a Bizonyítékok appot.", level: "info" },
                            "*"
                          );
                        }}
                      >
                        Kontextus átadása
                      </button>
                    </div>

                    <div style={{ marginTop: 10, opacity: 0.65, fontSize: 12 }}>
                      (MVP) A Bizonyítékok appban az “Új bizonyíték” automatikusan ehhez a reporthoz kapcsolódik.
                    </div>
                  </div>
`;

// Magyar komment: akkor szúrjuk be, ha még nem raktuk be
if (!s.includes("Kontextus átadása") && s.includes("setReportDetail(null)")) {
  const re = /(<button[^>]*setReportDetail\\(null\\)[\\s\\S]*?<\\/button>\\s*)/m;
  if (re.test(s)) {
    s = s.replace(re, `$1\n${panel}\n`);
  } else {
    console.log("INFO: Nem találtam biztos beszúrási pontot a report editorban (kihagytam a panelt).");
  }
}

fs.writeFileSync(FILE, s, "utf8");
console.log("OK: MDT evidence shortcut kész.");
