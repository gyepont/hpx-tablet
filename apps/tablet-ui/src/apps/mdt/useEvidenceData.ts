import { useEffect, useMemo, useState } from "react";
import {
  EvidenceItem,
  EVIDENCE_KEY,
  safeParseJson,
  normalizeEvidenceList,
  persistEvidence,
  pushEvent,
  nowIso,
  notify,
  filterEvidenceBySearch,
} from "./evidenceUtils";

export function useEvidenceData(reportId: string, actorName: string) {
  const [items, setItems] = useState<EvidenceItem[]>(() => {
    const raw = safeParseJson<unknown>(localStorage.getItem(EVIDENCE_KEY), []);
    return normalizeEvidenceList(raw);
  });

  // Poll for updates from localStorage
  useEffect(() => {
    const t = window.setInterval(() => {
      const raw = safeParseJson<unknown>(localStorage.getItem(EVIDENCE_KEY), []);
      setItems(normalizeEvidenceList(raw));
    }, 1200);
    return () => window.clearInterval(t);
  }, []);

  const linked = useMemo(() => items.filter((e) => (e.reportId ?? "") === reportId), [items, reportId]);

  function updateEvidence(next: EvidenceItem[]): void {
    setItems(next);
    persistEvidence(next);
  }

  function linkEvidence(evidenceId: string): void {
    const next = items.map((e) => {
      if (e.id !== evidenceId) return e;

      const already = (e.reportId ?? "") === reportId;
      if (already) return e;

      const updated: EvidenceItem = {
        ...e,
        reportId,
        updatedAt: nowIso(),
      };

      return pushEvent(updated, "Jelentéshez rendelve", actorName, `Jelentés: ${reportId}`);
    });

    updateEvidence(next);
    notify("MDT • Bizonyítékok", "Hozzárendelve a jelentéshez.", "success");
  }

  function unlinkEvidence(evidenceId: string): void {
    const next = items.map((e) => {
      if (e.id !== evidenceId) return e;

      const st = String(e.status ?? "NYITOTT");
      if (st === "SEALED") return e;

      const updated: EvidenceItem = {
        ...e,
        reportId: null,
        updatedAt: nowIso(),
      };

      return pushEvent(updated, "Jelentésről leválasztva", actorName, `Jelentés: ${reportId}`);
    });

    updateEvidence(next);
    notify("MDT • Bizonyítékok", "Leválasztva a jelentésről.", "info");
  }

  function searchEvidence(query: string): EvidenceItem[] {
    return filterEvidenceBySearch(items, query);
  }

  return {
    items,
    linked,
    linkEvidence,
    unlinkEvidence,
    searchEvidence,
  };
}
