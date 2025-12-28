import type { RpcEvent, RpcRequest, RpcResponse } from "./contracts";
import type { RpcTransport, RpcTransportKind } from "./transport";
import { createMockTransport } from "./transports/mock";
import { createNuiTransport, isNuiRuntime } from "./transports/nui";

let cachedTransport: RpcTransport | null = null;

export function getRpcTransportKind(): RpcTransportKind {
  return isNuiRuntime() ? "nui" : "mock";
}

export function getRpcTransport(): RpcTransport {
  if (cachedTransport) return cachedTransport;

  cachedTransport = isNuiRuntime() ? createNuiTransport() : createMockTransport();
  return cachedTransport;
}

/** Typed RPC call */
export async function rpcCall<K extends RpcEvent>(
  event: K,
  data: RpcRequest<K>,
  options?: { timeoutMs?: number }
): Promise<RpcResponse<K>> {
  const res = await getRpcTransport().request(event, data, { timeoutMs: options?.timeoutMs });
  return res as RpcResponse<K>;
}
