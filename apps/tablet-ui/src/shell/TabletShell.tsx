import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import type { ComponentType } from "react";
import { APPS, type TabletAppId, type TabletAppManifest } from "../core/apps";
import { ErrorBoundary } from "../core/ErrorBoundary";
import { getRpcTransportKind, rpcCall } from "../core/rpc/client";
import { DefaultTabletUiConfig } from "../core/ui/tabletUiConfig";
import { WALLPAPERS, type WallpaperId } from "../core/ui/wallpapers";
import { useLocalStorageState } from "../core/ui/useLocalStorage";
import { usePlayerContext } from "../core/session/usePlayerContext";
import type { Role } from "../core/session/types";

type OpenApp = { id: TabletAppId; loaded?: ComponentType };

type NotificationLevel = "info" | "success" | "warning" | "error";
type NotificationItem = {
  id: string;
  ts: string;
  title: string;
  message: string;
  level: NotificationLevel;
};

type ToastItem = {
  id: string;
  title: string;
  message: string;
  level: NotificationLevel;
};

function uid(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function coerceLevel(v: unknown): NotificationLevel {
  return v === "success" || v === "warning" || v === "error" || v === "info" ? v : "info";
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatRealTime(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

function isAppAllowed(app: TabletAppManifest, role: Role): boolean {
  if (!app.requiredRoles || app.requiredRoles.length === 0) return true;
  return app.requiredRoles.includes(role);
}

function reorder<T>(arr: T[], fromIndex: number, toIndex: number): T[] {
  const copy = [...arr];
  const [moved] = copy.splice(fromIndex, 1);
  copy.splice(toIndex, 0, moved);
  return copy;
}

function normalizeOrder(order: string[], apps: TabletAppManifest[]): TabletAppId[] {
  const valid = new Set(apps.map((a) => a.id));
  const filtered = order.filter((id) => valid.has(id as TabletAppId)) as TabletAppId[];
  const missing = apps.map((a) => a.id).filter((id) => !filtered.includes(id));
  return [...filtered, ...missing];
}

function buildDefaultHomeOrder(apps: TabletAppManifest[]): TabletAppId[] {
  return apps.map((a) => a.id);
}

function buildDefaultDockOrder(apps: TabletAppManifest[]): TabletAppId[] {
  return apps.filter((a) => a.dockDefault).map((a) => a.id);
}

export function TabletShell() {
  const cfg = DefaultTabletUiConfig;

  const [now, setNow] = useState(() => new Date());
  const [openApps, setOpenApps] = useState<OpenApp[]>([]);
  const [activeAppId, setActiveAppId] = useState<TabletAppId | null>(null);

  const [isIdle, setIsIdle] = useState(false);
  const idleTimerRef = useRef<number | null>(null);

  const isNui = useMemo(() => getRpcTransportKind() === "nui", []);
  const [wallpaperId] = useLocalStorageState<WallpaperId>("hpx.tablet.wallpaper", "hpx-amber");
  const [customWallpaperUrl] = useLocalStorageState<string>("hpx.tablet.wallpaperUrl", "");

  const [gameTime, setGameTime] = useState<{ hours: number; minutes: number } | null>(null);

  const { data: player, refresh: refreshPlayer } = usePlayerContext();
  const role: Role = player?.role ?? "civ";

  const visibleApps = useMemo(() => APPS.filter((a) => isAppAllowed(a, role)), [role]);

  // Home order per role
  const homeKey = `hpx.tablet.homeOrder.${role}`;
  const [homeOrderRaw, setHomeOrderRaw] = useLocalStorageState<string[]>(homeKey, buildDefaultHomeOrder(visibleApps));
  const homeOrder = useMemo(() => normalizeOrder(homeOrderRaw, visibleApps), [homeOrderRaw, visibleApps]);

  // Dock order per role (PIN-ek + sorrend)
  const dockKey = `hpx.tablet.dockOrder.${role}`;
  const [dockOrderRaw, setDockOrderRaw] = useLocalStorageState<string[]>(dockKey, buildDefaultDockOrder(visibleApps));
  const dockOrder = useMemo(() => normalizeOrder(dockOrderRaw, visibleApps), [dockOrderRaw, visibleApps]);

  // Szerkesztés (home + dock)
  const [isEditMode, setIsEditMode] = useState(false);
  const [draggingHomeId, setDraggingHomeId] = useState<TabletAppId | null>(null);
  const [dragOverHomeId, setDragOverHomeId] = useState<TabletAppId | null>(null);

  const [draggingDockId, setDraggingDockId] = useState<TabletAppId | null>(null);
  const [dragOverDockId, setDragOverDockId] = useState<TabletAppId | null>(null);

  // Menü és értesítések a TABLETEN BELÜL
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let alive = true;

    const tick = async () => {
      try {
        const res = await rpcCall("tablet:getGameTime", {}, { timeoutMs: 1500 });
        if (!alive) return;
        setGameTime({ hours: res.hours, minutes: res.minutes });
      } catch {
        // no-op
      }
    };

    void tick();
    const t = window.setInterval(tick, 1500);

    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, []);

  // Magyar komment: NUI -> értesítések (toast + list)
  useEffect(() => {
    const onMessage = (ev: MessageEvent) => {
      const d = ev.data as any;
      if (!d || d.type !== "hpx:notify") return;

      const level = coerceLevel(d.level);
      const title = String(d.title ?? "Értesítés");
      const message = String(d.message ?? "");

      const item: NotificationItem = {
        id: uid(),
        ts: new Date().toISOString(),
        title,
        message,
        level,
      };

      setNotifications((prev) => [item, ...prev].slice(0, 60));

      // Toast auto-dismiss
      const toastId = uid();
      const toast: ToastItem = { id: toastId, title, message, level };
      setToasts((prev) => [toast, ...prev].slice(0, 4));

      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toastId));
      }, 5200);
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const appById = useMemo(() => {
    const map = new Map<TabletAppId, TabletAppManifest>();
    for (const app of APPS) map.set(app.id, app);
    return map;
  }, []);

  const activeApp = useMemo(
    () => (activeAppId ? openApps.find((a) => a.id === activeAppId) ?? null : null),
    [openApps, activeAppId]
  );

  const wallpaperCss = useMemo(() => {
    const found = WALLPAPERS.find((w) => w.id === wallpaperId);
    return (found ?? WALLPAPERS[0]).css(customWallpaperUrl);
  }, [wallpaperId, customWallpaperUrl]);

  const orderedApps = useMemo(() => {
    const map = new Map(visibleApps.map((a) => [a.id, a] as const));
    return homeOrder.map((id) => map.get(id)).filter(Boolean) as TabletAppManifest[];
  }, [homeOrder, visibleApps]);

  const dockApps = useMemo(() => {
    const map = new Map(visibleApps.map((a) => [a.id, a] as const));
    return dockOrder.map((id) => map.get(id)).filter(Boolean) as TabletAppManifest[];
  }, [dockOrder, visibleApps]);

  const dockSet = useMemo(() => new Set(dockOrder), [dockOrder]);

  async function openApp(appId: TabletAppId) {
    if (isEditMode) return;

    setMenuOpen(false);
    setNotifOpen(false);

    const manifest = appById.get(appId);
    if (!manifest) return;

    if (!isAppAllowed(manifest, role)) {
      const item: NotificationItem = {
        id: uid(),
        ts: new Date().toISOString(),
        title: "Hozzáférés megtagadva",
        message: "Nincs jogosultságod ehhez az alkalmazáshoz.",
        level: "warning",
      };
      setNotifications((prev) => [item, ...prev].slice(0, 60));
      return;
    }

    const existing = openApps.find((a) => a.id === appId);
    if (existing) {
      setActiveAppId(appId);
      return;
    }

    setOpenApps((prev) => [...prev, { id: appId }]);
    setActiveAppId(appId);

    try {
      const mod = await manifest.load();
      setOpenApps((prev) => prev.map((a) => (a.id === appId ? { ...a, loaded: mod.default } : a)));
    } catch (e) {
      console.error("App betöltési hiba:", appId, e);
    }
  }

  function closeApp(appId: TabletAppId) {
    setOpenApps((prev) => {
      const next = prev.filter((a) => a.id !== appId);
      setActiveAppId((current) => {
        if (current !== appId) return current;
        return next.length ? next[next.length - 1].id : null;
      });
      return next;
    });
  }

  async function closeTablet(): Promise<void> {
    try {
      await rpcCall("tablet:close", {});
    } catch (e) {
      console.error("Tablet bezárási hiba:", e);
    }
  }

  function toggleEditMode(): void {
    setIsEditMode((v) => !v);
    setDraggingHomeId(null);
    setDragOverHomeId(null);
    setDraggingDockId(null);
    setDragOverDockId(null);
  }

  function resetLayout(): void {
    setHomeOrderRaw(buildDefaultHomeOrder(visibleApps));
    setDockOrderRaw(buildDefaultDockOrder(visibleApps));
    setDraggingHomeId(null);
    setDragOverHomeId(null);
    setDraggingDockId(null);
    setDragOverDockId(null);
  }

  function togglePinned(appId: TabletAppId): void {
    setDockOrderRaw((prev) => {
      const cur = normalizeOrder(prev, visibleApps);
      const exists = cur.includes(appId);
      if (exists) return cur.filter((id) => id !== appId);
      return [...cur, appId];
    });
  }

  // Home drag
  function onHomeDragStart(appId: TabletAppId, e: DragEvent) {
    setDraggingHomeId(appId);
    setDragOverHomeId(null);
    e.dataTransfer.setData("text/plain", appId);
    e.dataTransfer.effectAllowed = "move";
  }
  function onHomeDragOver(appId: TabletAppId, e: DragEvent) {
    e.preventDefault();
    if (!draggingHomeId) return;
    if (dragOverHomeId !== appId) setDragOverHomeId(appId);
  }
  function onHomeDrop(appId: TabletAppId, e: DragEvent) {
    e.preventDefault();
    const from = draggingHomeId;
    if (!from) return;

    const fromIndex = homeOrder.indexOf(from);
    const toIndex = homeOrder.indexOf(appId);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;

    setHomeOrderRaw(reorder(homeOrder, fromIndex, toIndex));
    setDraggingHomeId(null);
    setDragOverHomeId(null);
  }

  // Dock drag (csak edit módban)
  function onDockDragStart(appId: TabletAppId, e: DragEvent) {
    setDraggingDockId(appId);
    setDragOverDockId(null);
    e.dataTransfer.setData("text/plain", appId);
    e.dataTransfer.effectAllowed = "move";
  }
  function onDockDragOver(appId: TabletAppId, e: DragEvent) {
    e.preventDefault();
    if (!draggingDockId) return;
    if (dragOverDockId !== appId) setDragOverDockId(appId);
  }
  function onDockDrop(appId: TabletAppId, e: DragEvent) {
    e.preventDefault();
    const from = draggingDockId;
    if (!from) return;

    const fromIndex = dockOrder.indexOf(from);
    const toIndex = dockOrder.indexOf(appId);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;

    setDockOrderRaw(reorder(dockOrder, fromIndex, toIndex));
    setDraggingDockId(null);
    setDragOverDockId(null);
  }

  // Idle fade
  function clearIdleTimer(): void {
    if (idleTimerRef.current) {
      window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }
  function handleMouseEnter(): void {
    clearIdleTimer();
    setIsIdle(false);
  }
  function handleMouseLeave(): void {
    clearIdleTimer();
    idleTimerRef.current = window.setTimeout(() => setIsIdle(true), cfg.idleDelayMs);
  }

  const stageClass = `hpx-stage ${isIdle ? "hpx-idle" : ""}`.trim();
  const frameClass = `hpx-frame ${isIdle ? "hpx-idle" : ""}`.trim();

  const stageStyle = {
    ["--hpx-stage-pad" as any]: `${cfg.stagePaddingPx}px`,
    ["--hpx-frame-w" as any]: `${cfg.widthPx}px`,
    ["--hpx-frame-h" as any]: `${cfg.heightPx}px`,
    ["--hpx-frame-maxw" as any]: `${cfg.maxWidthVw}vw`,
    ["--hpx-frame-maxh" as any]: `${cfg.maxHeightVh}vh`,
    ["--hpx-idle-opacity" as any]: String(cfg.idleOpacity),
    ["--hpx-idle-ty" as any]: `${cfg.idleTranslateYPx}px`,
    ["--hpx-wallpaper" as any]: wallpaperCss,
  } as const;

  const gameTimeText = gameTime ? `${pad2(gameTime.hours)}:${pad2(gameTime.minutes)}` : "—";

  return (
    <div className={stageClass} style={stageStyle}>
      <div className="hpx-backdrop" />

      <div className={frameClass} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
        <div className="hpx-topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button className="hpx-btn" onClick={() => setMenuOpen((v) => !v)}>Menü</button>
            <div style={{ fontWeight: 900, letterSpacing: 0.5 }}>HPX TABLET</div>
            <div style={{ opacity: 0.7, fontSize: 12 }}>
              {player ? `${player.name} • ${player.jobLabel}${player.duty ? " • SZOLGÁLAT" : ""}` : "Betöltés…"}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button className={`hpx-btn ${notifOpen ? "hpx-btnAccent" : ""}`} onClick={() => setNotifOpen((v) => !v)}>
              Értesítések
            </button>

            <div style={{ opacity: 0.85, fontSize: 13 }}>
              <span style={{ opacity: 0.65 }}>Játékidő:</span>{" "}
              <span style={{ fontWeight: 900 }}>{gameTimeText}</span>
            </div>

            <div style={{ opacity: 0.65, fontSize: 13 }}>
              <span style={{ opacity: 0.65 }}>Idő:</span>{" "}
              <span style={{ fontWeight: 900 }}>{formatRealTime(now)}</span>
            </div>

            {isNui ? <button className="hpx-btn" onClick={closeTablet}>Kilépés</button> : null}
          </div>
        </div>

        <div className="hpx-screen">
          <div className="hpx-wallpaper" />
          <div className="hpx-scanlines" />
          <div className="hpx-dust" />

          {/* MENU a tableten belül */}
          {menuOpen && (
            <div
              style={{
                position: "absolute",
                top: 58,
                left: 0,
                width: 380,
                height: "calc(100% - 58px)",
                zIndex: 18,
                borderRight: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(0,0,0,0.22)",
                backdropFilter: "blur(12px)",
                padding: 12,
                overflow: "auto",
              }}
            >
              <div style={{ fontWeight: 900, marginBottom: 8 }}>Menü</div>
              <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 12 }}>
                {player ? `${player.name} • ${player.jobLabel}` : "Betöltés…"}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button className="hpx-btn" onClick={() => openApp("profile")}>Profil</button>
                <button className="hpx-btn" onClick={() => openApp("settings")}>Beállítások</button>
                <button className="hpx-btn" onClick={() => setActiveAppId(null)}>Kezdőképernyő</button>
                <button className="hpx-btn" onClick={() => void refreshPlayer()}>Profil frissítés</button>
                <button className="hpx-btn" onClick={toggleEditMode}>{isEditMode ? "Szerkesztés: KI" : "Szerkesztés: BE"}</button>
                <button className="hpx-btn" onClick={resetLayout}>Alaphelyzet</button>
              </div>
            </div>
          )}

          {/* Értesítések panel a tableten belül */}
          {notifOpen && (
            <div className="hpx-notifPanel">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontWeight: 900 }}>Értesítések</div>
                <button className="hpx-btn" onClick={() => setNotifications([])}>Törlés</button>
              </div>

              {notifications.length === 0 ? (
                <div style={{ opacity: 0.7 }}>Nincs új értesítés.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {notifications.map((n) => (
                    <div key={n.id} style={{ border: "1px solid rgba(255,255,255,0.10)", background: "rgba(0,0,0,0.16)", padding: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ fontWeight: 900 }}>{n.title}</div>
                        <div style={{ opacity: 0.6, fontSize: 11 }}>{n.ts.slice(11, 19)}</div>
                      </div>
                      <div style={{ opacity: 0.75, marginTop: 6, fontSize: 13 }}>{n.message}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Toastok a tableten belül */}
          {toasts.length > 0 && (
            <div className="hpx-toastStack">
              {toasts.map((t) => (
                <div key={t.id} className="hpx-toast" onClick={() => setNotifOpen(true)} title="Katt: értesítések megnyitása">
                  <div className="hpx-toastTitle">{t.title}</div>
                  <div className="hpx-toastMsg">{t.message}</div>
                </div>
              ))}
            </div>
          )}

          {activeApp ? (
            <div className="hpx-appView">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontWeight: 900, fontSize: 16 }}>
                  {appById.get(activeAppId!)?.title ?? "Alkalmazás"}
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="hpx-btn" onClick={() => setActiveAppId(null)}>Kezdőképernyő</button>
                  <button className="hpx-btn" onClick={() => closeApp(activeAppId!)}>Bezárás</button>
                </div>
              </div>

              <ErrorBoundary>
                <Suspense fallback={<div style={{ opacity: 0.75 }}>Betöltés…</div>}>
                  {activeApp.loaded ? <activeApp.loaded /> : <div style={{ opacity: 0.75 }}>Betöltés…</div>}
                </Suspense>
              </ErrorBoundary>
            </div>
          ) : (
            <div className="hpx-home">
              <div className="hpx-homeTop">
                <div className="hpx-widgets">
                  <div className="hpx-widget">
                    <div className="hpx-widgetTitle">Játékidő</div>
                    <div className="hpx-widgetValue">{gameTimeText}</div>
                  </div>
                  <div className="hpx-widget">
                    <div className="hpx-widgetTitle">Rendszeridő</div>
                    <div className="hpx-widgetValue">{formatRealTime(now)}</div>
                  </div>
                  <div className="hpx-widget" style={{ borderColor: "rgba(255,216,76,0.20)" }}>
                    <div className="hpx-widgetTitle">Tipp</div>
                    <div className="hpx-widgetValue" style={{ fontSize: 13, fontWeight: 800 }}>
                      {isEditMode ? "Húzd-vidd az ikonokat • Dock: pin/unpin + drag" : "Szerkesztés: ikonok + dock rendezés"}
                    </div>
                  </div>
                </div>

                <div className="hpx-homeActions">
                  <button className={`hpx-btn ${isEditMode ? "hpx-btnAccent" : ""}`} onClick={toggleEditMode}>
                    {isEditMode ? "Kész" : "Szerkesztés"}
                  </button>
                  <button className="hpx-btn" onClick={resetLayout}>Alaphelyzet</button>
                </div>
              </div>

              <div className="hpx-grid">
                {orderedApps.map((app) => {
                  const over = dragOverHomeId === app.id && draggingHomeId !== null && draggingHomeId !== app.id;
                  const tileClass = [
                    "hpx-appTile",
                    isEditMode ? "hpx-appTileEdit" : "",
                    over ? "hpx-appTileOver" : "",
                  ].filter(Boolean).join(" ");

                  const pinned = dockSet.has(app.id);

                  return (
                    <div
                      key={app.id}
                      className={tileClass}
                      draggable={isEditMode}
                      onDragStart={(e) => onHomeDragStart(app.id, e)}
                      onDragOver={(e) => onHomeDragOver(app.id, e)}
                      onDrop={(e) => onHomeDrop(app.id, e)}
                      onDragEnd={() => {
                        setDraggingHomeId(null);
                        setDragOverHomeId(null);
                      }}
                      onClick={() => (isEditMode ? togglePinned(app.id) : openApp(app.id))}
                      title={isEditMode ? "Klikk: Dock pin/unpin • Húzd-vidd: rendezés" : app.title}
                    >
                      {isEditMode && <div className="hpx-editBadge">⠿</div>}
                      {isEditMode && <div className="hpx-pinBadge">{pinned ? "📌 Dock" : "＋ Dock"}</div>}
                      <div className="hpx-appIcon">{app.icon}</div>
                      <div className="hpx-appName">{app.title}</div>
                      <div className="hpx-appHint">{isEditMode ? "Klikk: pin/unpin" : "Megnyitás"}</div>
                    </div>
                  );
                })}
              </div>

              <div className="hpx-dock">
                {dockApps.map((app) => {
                  const over = dragOverDockId === app.id && draggingDockId !== null && draggingDockId !== app.id;
                  const cls = ["hpx-dockBtn", over ? "hpx-dockBtnOver" : ""].join(" ");

                  return (
                    <button
                      key={app.id}
                      className={cls}
                      draggable={isEditMode}
                      onDragStart={(e) => onDockDragStart(app.id, e)}
                      onDragOver={(e) => onDockDragOver(app.id, e)}
                      onDrop={(e) => onDockDrop(app.id, e)}
                      onDragEnd={() => {
                        setDraggingDockId(null);
                        setDragOverDockId(null);
                      }}
                      onClick={() => (isEditMode ? togglePinned(app.id) : openApp(app.id))}
                      title={isEditMode ? "Húzd-vidd: dock sorrend • Klikk: unpin" : app.title}
                    >
                      <span style={{ fontSize: 20 }}>{app.icon}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
