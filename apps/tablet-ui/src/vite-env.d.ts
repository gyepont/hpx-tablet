/// <reference types="vite/client" />

declare global {
  interface Window {
    /** FiveM NUI-ban létezik */
    GetParentResourceName?: () => string;
  }
}

export {};
