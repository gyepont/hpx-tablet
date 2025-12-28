export type RpcTransportKind = "mock" | "nui";

export type RpcRequestOptions = {
  timeoutMs?: number;
};

export interface RpcTransport {
  kind: RpcTransportKind;

  /** Alap request metódus (event + payload -> response) */
  request(event: string, data: unknown, options?: RpcRequestOptions): Promise<unknown>;
}
