import type { RpcRequestOptions, RpcTransport } from "../transport";

/** NUI runtime detektálás (FiveM) */
export function isNuiRuntime(): boolean {
  return typeof (window as any).GetParentResourceName === "function";
}

function getResourceName(): string {
  try {
    const fn = (window as any).GetParentResourceName as undefined | (() => string);
    const name = fn?.();
    return name && typeof name === "string" ? name : "unknown-resource";
  } catch {
    return "unknown-resource";
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let t: number | undefined;

  const timeout = new Promise<never>((_, reject) => {
    t = window.setTimeout(() => reject(new Error(`RPC timeout (${timeoutMs}ms)`)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (t) window.clearTimeout(t);
  }
}

/** FiveM NUI fetch (https://resourceName/event) */
async function postNui(event: string, data: unknown): Promise<unknown> {
  const resource = getResourceName();
  const url = `https://${resource}/${event}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify(data ?? {}),
  });

  // NUI callback általában JSON-t ad vissza
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`NUI RPC failed (${res.status}): ${text || res.statusText}`);
  }

  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

export function createNuiTransport(): RpcTransport {
  return {
    kind: "nui",
    request: async (event: string, data: unknown, options?: RpcRequestOptions) => {
      const timeoutMs = options?.timeoutMs ?? 8000;
      return await withTimeout(postNui(event, data), timeoutMs);
    },
  };
}
