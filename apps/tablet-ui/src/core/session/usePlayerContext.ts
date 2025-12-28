import { useCallback, useEffect, useMemo, useState } from "react";
import { getRpcTransportKind, rpcCall } from "../rpc/client";
import type { PlayerContext } from "./types";

export function usePlayerContext() {
  const [data, setData] = useState<PlayerContext | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const isNui = useMemo(() => getRpcTransportKind() === "nui", []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await rpcCall("tablet:getPlayerContext", {}, { timeoutMs: 2500 });
      setData(res.context);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    // Magyar komment: NUI-ban polloljuk, hogy job váltásnál frissüljön a role és feljöjjön az MDT
    if (!isNui) return;

    const t = window.setInterval(() => {
      void refresh();
    }, 1500);

    return () => window.clearInterval(t);
  }, [isNui, refresh]);

  return { data, loading, error, refresh } as const;
}
