import React from "react";

type Props = { children: React.ReactNode; fallback?: React.ReactNode };
type State = { hasError: boolean; error?: unknown };

/** Biztonsági háló: ha egy app elhasal, a tablet shell nem dől össze */
export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = { hasError: false };

  public static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: unknown): void {
    console.error("Tablet app crashed:", error);
  }

  public render(): React.ReactNode {
    if (!this.state.hasError) return this.props.children;
    return (
      this.props.fallback ?? (
        <div style={{ padding: 14 }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Az app összeomlott</div>
          <div style={{ opacity: 0.75, fontSize: 13 }}>
            A tablet ettől még stabil marad.
          </div>
        </div>
      )
    );
  }
}
