import { useEffect, useMemo, useState } from "react";
import { TabletShell } from "./shell/TabletShell";
import { getRpcTransportKind, rpcCall } from "./core/rpc/client";

type VisibilityMsg = { type: "hpx:tablet:visible"; visible: boolean };

export default function App() {
  const isNui = useMemo(() => getRpcTransportKind() === "nui", []);
  const [visible, setVisible] = useState<boolean>(() => (isNui ? false : true));

  useEffect(() => {
    // Magyar komment: web/dev módban legyen háttér, FiveM-ben átlátszó
    document.body.classList.toggle("web-bg", !isNui);
  }, [isNui]);

  useEffect(() => {
    if (!isNui) return;

    // Magyar komment: NUI -> UI üzenet (láthatóság)
    const onMessage = (ev: MessageEvent) => {
      const data = ev.data as VisibilityMsg;
      if (!data || data.type !== "hpx:tablet:visible") return;
      setVisible(!!data.visible);
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [isNui]);

  useEffect(() => {
    if (!isNui) return;
    document.body.classList.toggle("nui-hidden", !visible);
  }, [isNui, visible]);

  useEffect(() => {
    if (!isNui || !visible) return;

    // Magyar komment: ESC bezárja a teljes tabletet
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      void rpcCall("tablet:close", {});
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isNui, visible]);

  return <TabletShell />;
}
