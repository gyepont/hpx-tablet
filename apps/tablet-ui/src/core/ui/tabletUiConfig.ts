export type TabletUiConfig = {
  widthPx: number;
  heightPx: number;

  maxWidthVw: number;
  maxHeightVh: number;

  stagePaddingPx: number;

  idleOpacity: number;          // 0..1
  idleTranslateYPx: number;
  idleDelayMs: number;
};

/** Magyar komment: HPX tablet ablak beállítások */
export const DefaultTabletUiConfig: TabletUiConfig = {
  // Magyar komment: nagyobb tablet (2026 feel)
  widthPx: 1480,
  heightPx: 920,

  maxWidthVw: 98,
  maxHeightVh: 95,

  stagePaddingPx: 18,

  idleOpacity: 0.62,
  idleTranslateYPx: 2,
  idleDelayMs: 180,
};
