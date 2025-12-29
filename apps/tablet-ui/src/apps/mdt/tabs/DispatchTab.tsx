import type { MdtCallStatus, MdtDispatchCall, MdtUnit } from "../../../core/mdt/types";

export type DispatchTabProps = {
  calls: MdtDispatchCall[];
  unitById: Map<string, MdtUnit>;

  selectedUnit: MdtUnit | null;
  selectedUnitId: string | null;

  selectedCallId: string | null;
  setSelectedCallId: (id: string | null) => void;

  selectedCall: MdtDispatchCall | null;

  dispatchReportDraft: string;
  setDispatchReportDraft: (val: string) => void;

  acceptCall: (callId: string, unitId: string) => Promise<void>;
  setWaypoint: (call: MdtDispatchCall) => Promise<void>;
  updateCallStatus: (callId: string, status: MdtCallStatus) => Promise<void>;
  addNote: (callId: string) => Promise<void>;
  closeCall: (callId: string) => Promise<void>;

  hhmmss: (ts: string) => string;
  getCallAccent: (status: MdtCallStatus) => { dot: string; border: string };
};

export default function DispatchTab(props: DispatchTabProps) {
  const {
    calls,
    unitById,
    selectedUnit,
    selectedUnitId,
    selectedCallId,
    setSelectedCallId,
    selectedCall,
    dispatchReportDraft,
    setDispatchReportDraft,
    acceptCall,
    setWaypoint,
    updateCallStatus,
    addNote,
    closeCall,
    hhmmss,
    getCallAccent,
  } = props;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 12 }}>
      <div style={{ border: "1px solid rgba(255,255,255,0.10)", padding: 10 }}>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>
          Hívások {selectedUnit ? `• Kijelölt egység: ${selectedUnit.callsign}` : ""}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {calls.map((c) => {
            const unit = c.assignedUnitId ? unitById.get(c.assignedUnitId) ?? null : null;
            const selected = selectedCallId === c.id;
            const accent = getCallAccent(c.status);

            return (
              <div
                key={c.id}
                style={{
                  border: `1px solid ${accent.border}`,
                  padding: 10,
                  cursor: "pointer",
                  boxShadow: selected ? "0 0 0 3px rgba(255,216,76,0.10)" : "none",
                }}
                onClick={() => {
                  setSelectedCallId(c.id);
                  setDispatchReportDraft(c.reportSummary ?? "");
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 999,
                        background: accent.dot,
                        boxShadow: `0 0 12px ${accent.dot}`,
                      }}
                    />
                    <div style={{ fontWeight: 900 }}>
                      {c.code} • {c.title}
                    </div>
                  </div>
                  <div style={{ opacity: 0.7 }}>{hhmmss(c.ts)}</div>
                </div>

                <div style={{ opacity: 0.78, marginTop: 6, fontSize: 13 }}>{c.location}</div>

                {c.reportSummary && (
                  <div style={{ opacity: 0.85, marginTop: 8, fontSize: 12 }}>
                    Jelentés (rövid): {c.reportSummary}
                  </div>
                )}

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 10 }}>
                  <div style={{ opacity: 0.75, fontSize: 12 }}>
                    Egység: <span style={{ fontWeight: 900 }}>{unit?.callsign ?? "—"}</span>
                  </div>

                  {!unit && c.status !== "Lezárva" && selectedUnitId && (
                    <button className="hpx-btn hpx-btnAccent" onClick={() => void acceptCall(c.id, selectedUnitId)}>
                      Jelentkezés
                    </button>
                  )}

                  {c.reportId && (
                    <button className="hpx-btn" disabled title="Jelentés megnyitás a Jelentések fülről van">
                      Jelentés
                    </button>
                  )}

                  <button
                    className="hpx-btn"
                    onClick={() => void setWaypoint(c)}
                    disabled={!c.origin}
                    style={{ opacity: c.origin ? 1 : 0.55 }}
                  >
                    Útvonal
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ border: "1px solid rgba(255,255,255,0.10)", padding: 10 }}>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>Hívás részletek</div>

        {!selectedCall ? (
          <div style={{ opacity: 0.7 }}>Válassz egy hívást.</div>
        ) : (
          <div>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>
              {selectedCall.code} • {selectedCall.title}
            </div>
            <div style={{ opacity: 0.8, fontSize: 13, marginBottom: 10 }}>{selectedCall.location}</div>

            {selectedCall.status === "Lezárva" ? (
              <div style={{ border: "1px solid rgba(47,232,110,0.25)", padding: 10 }}>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>Lezárva</div>
                <div style={{ opacity: 0.85, fontSize: 12 }}>{selectedCall.reportSummary ?? "—"}</div>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                  <button className="hpx-btn" onClick={() => void updateCallStatus(selectedCall.id, "Úton")}>
                    Úton
                  </button>
                  <button className="hpx-btn" onClick={() => void updateCallStatus(selectedCall.id, "Helyszínen")}>
                    Helyszínen
                  </button>
                  <button className="hpx-btn" onClick={() => void addNote(selectedCall.id)}>
                    Megjegyzés
                  </button>
                </div>

                <div style={{ fontWeight: 900, marginBottom: 6 }}>Lezárás + rövid jelentés</div>
                <textarea
                  value={dispatchReportDraft}
                  onChange={(e) => setDispatchReportDraft(e.target.value)}
                  placeholder="Rövid jelentés…"
                  style={{
                    width: "100%",
                    minHeight: 90,
                    padding: "10px 10px",
                    borderRadius: 0,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(0,0,0,0.18)",
                    color: "rgba(255,255,255,0.92)",
                    outline: "none",
                  }}
                />

                <div style={{ marginTop: 10 }}>
                  <button className="hpx-btn hpx-btnAccent" onClick={() => void closeCall(selectedCall.id)}>
                    Lezárás
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
