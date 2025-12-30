import fs from "node:fs";
import path from "node:path";

const FILE = path.resolve("apps/tablet-ui/src/apps/mdt/MdtApp.tsx");
const KEY = "hpx:evidence:lastReportId:v1";

let s = fs.readFileSync(FILE, "utf8");

// Magyar komment: ha valaha szó szerint "\n" került a TSX-be, azt visszajavítjuk normál sortörésre
s = s.split("setReportDetail(res.report);\\n").join("setReportDetail(res.report);\n");
s = s.split("} catch {}\\n").join("} catch {}\n");

// 1) Report megnyitásakor mentsük el a reportId-t localStorage-ba (ha még nincs benne)
if (!s.includes(KEY)) {
  const needle = "setReportDetail(res.report);";
  const idx = s.indexOf(needle);

  if (idx !== -1) {
    const replacement =
      'setReportDetail(res.report);\n' +
      `    try { localStorage.setItem("${KEY}", JSON.stringify(res.report.id)); } catch {}\n`;
    s = s.replace(needle, replacement);
  } else {
    console.log("INFO: Nem találtam 'setReportDetail(res.report);' sort, ezért csak a gombot próbálom betenni.");
  }
}

// 2) Jelentés szerkesztőbe tegyünk egy gombot: “Bizonyítékok” (kontextus beállítás + toast)
// Magyar komment: csak akkor tesszük be, ha még nincs benne
if (!s.includes("Kontextus beállítva (jelentés)")) {
  const anchor = "setReportDetail(null); setSelectedReportId(null);";
  const aIdx = s.indexOf(anchor);

  if (aIdx !== -1) {
    const endBtn = s.indexOf("</button>", aIdx);
    if (endBtn !== -1) {
      const insertPos = endBtn + "</button>".length;

      const button = `
                    <button
                      className="hpx-btn"
                      onClick={() => {
                        try { localStorage.setItem("${KEY}", JSON.stringify(reportDetail.id)); } catch {}
                        window.postMessage(
                          { type: "hpx:notify", title: "Bizonyítékok", message: "Kontextus beállítva (jelentés). Nyisd meg a Bizonyítékok appot.", level: "info" },
                          "*"
                        );
                      }}
                    >
                      Bizonyítékok
                    </button>`;

      s = s.slice(0, insertPos) + button + s.slice(insertPos);
    } else {
      console.log("INFO: Nem találtam a Bezárás gomb lezárását (</button>), gomb beszúrás kihagyva.");
    }
  } else {
    console.log("INFO: Nem találtam a 'setReportDetail(null); setSelectedReportId(null);' anchor-t, gomb beszúrás kihagyva.");
  }
}

fs.writeFileSync(FILE, s, "utf8");
console.log("OK: MDT evidence context kész.");
