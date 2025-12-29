import type { DragEvent } from "react";
import type { MdtOfficer, MdtUnit, MdtUnitStatus } from "../../../core/mdt/types";

export type UnitsTabProps = {
  officers: MdtOfficer[];
  units: MdtUnit[];

  unitById: Map<string, MdtUnit>;
  officerByCid: Map<number, MdtOfficer>;

  selectedUnitId: string | null;
  setSelectedUnitId: (id: string | null) => void;
  selectedUnit: MdtUnit | null;

  onOfficerDragStart: (cid: number, e: DragEvent<HTMLDivElement>) => void;
  onUnitDrop: (unitId: string, e: DragEvent<HTMLDivElement>) => Promise<void>;

  setUnitStatus: (unitId: string, status: MdtUnitStatus) => Promise<void>;
};

export default function UnitsTab(props: UnitsTabProps) {
  const {
    officers,
    units,
    unitById,
    officerByCid,
    selectedUnitId,
    setSelectedUnitId,
    selectedUnit,
    onOfficerDragStart,
    onUnitDrop,
    setUnitStatus,
  } = props;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      <div style={{ border: "1px solid rgba(255,255,255,0.10)", padding: 10 }}>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>Járőrök</div>
        <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 10 }}>Drag → egység</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {officers
            .filter((o) => o.onDuty)
            .map((o) => (
              <div
                key={o.cid}
                draggable
                onDragStart={(e) => onOfficerDragStart(o.cid, e)}
                style={{ border: "1px solid rgba(255,255,255,0.10)", padding: 10, cursor: "grab" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ fontWeight: 900 }}>{o.name}</div>
                  <div style={{ opacity: 0.75, fontSize: 12 }}>CID: {o.cid}</div>
                </div>
                <div style={{ opacity: 0.75, fontSize: 12, marginTop: 6 }}>
                  Egység: {o.unitId ? unitById.get(o.unitId)?.callsign ?? "—" : "—"}
                </div>
              </div>
            ))}
        </div>
      </div>

      <div style={{ border: "1px solid rgba(255,255,255,0.10)", padding: 10 }}>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>Egységek</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {units.length === 0 ? (
            <div style={{ opacity: 0.7 }}>Nincs egység.</div>
          ) : (
            units.map((u) => {
              const available = u.status === "Elérhető";
              const border = available ? "rgba(47,232,110,0.25)" : "rgba(255,59,59,0.25)";
              const dot = available ? "#2fe86e" : "#ff3b3b";

              return (
                <div
                  key={u.id}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => void onUnitDrop(u.id, e)}
                  style={{ border: `1px solid ${border}`, padding: 10 }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 999, background: dot, boxShadow: `0 0 12px ${dot}` }} />
                      <div style={{ fontWeight: 900 }}>{u.callsign}</div>
                    </div>
                    <div style={{ opacity: 0.75, fontSize: 12 }}>{u.status}</div>
                  </div>

                  <div style={{ opacity: 0.75, fontSize: 12, marginTop: 6 }}>
                    Tagok:{" "}
                    {u.members.length
                      ? u.members.map((cid) => officerByCid.get(cid)?.name ?? String(cid)).join(", ")
                      : "—"}
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                    <button className="hpx-btn" onClick={() => setSelectedUnitId(u.id)} style={{ opacity: selectedUnitId === u.id ? 1 : 0.8 }}>
                      Kijelöl
                    </button>
                    <button className="hpx-btn" onClick={() => void setUnitStatus(u.id, "Elérhető")}>Elérhető</button>
                    <button className="hpx-btn" onClick={() => void setUnitStatus(u.id, "Nem elérhető")}>Nem elérhető</button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div style={{ marginTop: 10, opacity: 0.75 }}>
          Kijelölt egység: <b>{selectedUnit ? selectedUnit.callsign : "—"}</b>
        </div>
      </div>
    </div>
  );
}
