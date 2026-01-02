import { EvidenceItem } from "./evidenceUtils";

type EvidenceRowProps = {
  evidence: EvidenceItem;
  reportId: string;
  showReport: boolean;
  onLink: (evidenceId: string) => void;
  onUnlink: (evidenceId: string) => void;
  onOpen: (evidenceId: string) => void;
};

export default function EvidenceRow({ evidence, reportId, showReport, onLink, onUnlink, onOpen }: EvidenceRowProps) {
  const isLinked = (evidence.reportId ?? "") === reportId;
  const sealed = String(evidence.status ?? "NYITOTT") === "SEALED";

  return (
    <div style={{ border: "1px solid rgba(255,255,255,0.10)", padding: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontWeight: 900 }}>{evidence.label}</div>
        <div style={{ opacity: 0.7, fontSize: 12 }}>
          {String(evidence.type ?? "—")} • {String(evidence.status ?? "—")}
        </div>
      </div>

      <div style={{ opacity: 0.72, fontSize: 12, marginTop: 6 }}>
        ID: {evidence.id}
        {" • "}
        Birtokos: <b>{evidence.holder ?? "—"}</b>
        {showReport && (
          <>
            {" • "}
            Jelentés: <b>{evidence.reportId ?? "—"}</b>
          </>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
        {!isLinked ? (
          <button className="hpx-btn hpx-btnAccent" onClick={() => onLink(evidence.id)}>
            Hozzárendelés
          </button>
        ) : (
          <button className="hpx-btn" onClick={() => onUnlink(evidence.id)} disabled={sealed} style={{ opacity: sealed ? 0.55 : 1 }}>
            Leválasztás
          </button>
        )}

        <button className="hpx-btn" onClick={() => onOpen(evidence.id)}>
          Megnyitás
        </button>
      </div>

      {sealed && isLinked && (
        <div style={{ marginTop: 8, opacity: 0.7, fontSize: 12 }}>
          Lepecsételt bizonyíték: leválasztás tiltva.
        </div>
      )}
    </div>
  );
}
