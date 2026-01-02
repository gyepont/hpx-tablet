import { useState } from "react";
import { requestCaseFromReport, openEvidence } from "./evidenceUtils";
import { useEvidenceData } from "./useEvidenceData";
import EvidenceRow from "./EvidenceRow";

type ViewMode = "KAPCSOLT" | "KERESÉS";

type ReportEvidencePanelProps = {
  reportId: string;
  reportTitle?: string;
  actorName: string;
};

export default function ReportEvidencePanel({ reportId, reportTitle, actorName }: ReportEvidencePanelProps) {
  const [open, setOpen] = useState<boolean>(false);
  const [view, setView] = useState<ViewMode>("KAPCSOLT");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const { linked, linkEvidence, unlinkEvidence, searchEvidence } = useEvidenceData(reportId, actorName);

  const searchResults = searchEvidence(searchQuery);
  const caseTitle = (reportTitle && reportTitle.trim()) ? reportTitle.trim() : `Jelentés • ${reportId}`;

  return (
    <div style={{ border: "1px solid rgba(255,255,255,0.10)", padding: 10, marginBottom: 10 }}>
      <PanelHeader
        reportId={reportId}
        linkedCount={linked.length}
        caseTitle={caseTitle}
        actorName={actorName}
        open={open}
        onToggle={() => setOpen((v) => !v)}
      />

      {!open ? (
        <CollapsedMessage />
      ) : (
        <ExpandedContent
          view={view}
          onViewChange={setView}
          linkedCount={linked.length}
          linked={linked}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          searchResults={searchResults}
          reportId={reportId}
          onLink={linkEvidence}
          onUnlink={unlinkEvidence}
          onOpen={openEvidence}
        />
      )}
    </div>
  );
}

type PanelHeaderProps = {
  reportId: string;
  linkedCount: number;
  caseTitle: string;
  actorName: string;
  open: boolean;
  onToggle: () => void;
};

function PanelHeader({ reportId, linkedCount, caseTitle, actorName, open, onToggle }: PanelHeaderProps) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
      <div>
        <div style={{ fontWeight: 900 }}>Bizonyítékok</div>
        <div style={{ opacity: 0.7, fontSize: 12 }}>
          Kapcsolt: <b>{linkedCount}</b> • Jelentés ID: <b>{reportId}</b>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button className="hpx-btn" onClick={() => requestCaseFromReport(reportId, caseTitle, actorName)}>
          Ügy javaslat
        </button>
        <button className="hpx-btn hpx-btnAccent" onClick={onToggle}>
          {open ? "Bezár" : "Megnyit"}
        </button>
      </div>
    </div>
  );
}

function CollapsedMessage() {
  return (
    <div style={{ marginTop: 10, opacity: 0.75, fontSize: 12 }}>
      (Összecsukva) Nyisd meg, ha linkelni vagy keresni akarsz.
    </div>
  );
}

type ExpandedContentProps = {
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
  linkedCount: number;
  linked: any[];
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  searchResults: any[];
  reportId: string;
  onLink: (id: string) => void;
  onUnlink: (id: string) => void;
  onOpen: (id: string) => void;
};

function ExpandedContent({
  view,
  onViewChange,
  linkedCount,
  linked,
  searchQuery,
  onSearchQueryChange,
  searchResults,
  reportId,
  onLink,
  onUnlink,
  onOpen,
}: ExpandedContentProps) {
  return (
    <>
      <ViewToggle view={view} onViewChange={onViewChange} linkedCount={linkedCount} />

      {view === "KAPCSOLT" && (
        <LinkedView linked={linked} reportId={reportId} onLink={onLink} onUnlink={onUnlink} onOpen={onOpen} />
      )}

      {view === "KERESÉS" && (
        <SearchView
          searchQuery={searchQuery}
          onSearchQueryChange={onSearchQueryChange}
          searchResults={searchResults}
          reportId={reportId}
          onLink={onLink}
          onUnlink={onUnlink}
          onOpen={onOpen}
        />
      )}
    </>
  );
}

type ViewToggleProps = {
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
  linkedCount: number;
};

function ViewToggle({ view, onViewChange, linkedCount }: ViewToggleProps) {
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
      <button className={`hpx-btn ${view === "KAPCSOLT" ? "hpx-btnAccent" : ""}`} onClick={() => onViewChange("KAPCSOLT")}>
        Kapcsolt ({linkedCount})
      </button>
      <button className={`hpx-btn ${view === "KERESÉS" ? "hpx-btnAccent" : ""}`} onClick={() => onViewChange("KERESÉS")}>
        Keresés / Hozzárendelés
      </button>
    </div>
  );
}

type LinkedViewProps = {
  linked: any[];
  reportId: string;
  onLink: (id: string) => void;
  onUnlink: (id: string) => void;
  onOpen: (id: string) => void;
};

function LinkedView({ linked, reportId, onLink, onUnlink, onOpen }: LinkedViewProps) {
  return (
    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8, maxHeight: 260, overflow: "auto" }}>
      {linked.length === 0 ? (
        <div style={{ opacity: 0.7, fontSize: 13 }}>Nincs még kapcsolt bizonyíték.</div>
      ) : (
        linked.slice(0, 20).map((e) => (
          <EvidenceRow key={e.id} evidence={e} reportId={reportId} showReport={false} onLink={onLink} onUnlink={onUnlink} onOpen={onOpen} />
        ))
      )}
    </div>
  );
}

type SearchViewProps = {
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  searchResults: any[];
  reportId: string;
  onLink: (id: string) => void;
  onUnlink: (id: string) => void;
  onOpen: (id: string) => void;
};

function SearchView({ searchQuery, onSearchQueryChange, searchResults, reportId, onLink, onUnlink, onOpen }: SearchViewProps) {
  return (
    <div style={{ marginTop: 10 }}>
      <input
        value={searchQuery}
        onChange={(e) => onSearchQueryChange(e.target.value)}
        placeholder="Keresés (név / ID / tag / birtokos)…"
        style={{
          width: "100%",
          padding: "10px 10px",
          borderRadius: 0,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(0,0,0,0.18)",
          color: "rgba(255,255,255,0.92)",
          outline: "none",
        }}
      />

      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8, maxHeight: 280, overflow: "auto" }}>
        {searchResults.map((e) => (
          <EvidenceRow key={e.id} evidence={e} reportId={reportId} showReport={true} onLink={onLink} onUnlink={onUnlink} onOpen={onOpen} />
        ))}
      </div>

      <div style={{ marginTop: 10, opacity: 0.65, fontSize: 12 }}>
        Audit csak műveleteknél íródik (nem gépelésre).
      </div>
    </div>
  );
}
