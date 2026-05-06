export type RconErrorCode =
  | "bad_auth"
  | "bad_request"
  | "not_connected"
  | "not_found"
  | "internal";

export class RconError extends Error {
  constructor(
    public readonly code: RconErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "RconError";
  }
}

export interface RconExecRequest {
  verb: string;
  args?: Record<string, unknown>;
  requestId?: string;
}

export interface RconExecSuccess {
  ok: true;
  requestId?: string;
  result: unknown;
}

export interface RconExecFailure {
  ok: false;
  requestId?: string;
  error: { code: RconErrorCode; message: string };
}

export type RconExecResponse = RconExecSuccess | RconExecFailure;

export interface AuditEntry {
  ts: string;
  actor: string;
  verb: string;
  args: Record<string, unknown>;
  ok: boolean;
  durationMs: number;
  requestId?: string;
  error?: { code: RconErrorCode; message: string };
}

export interface PlayerConnectPayload {
  userId: number;
  ip: string;
  ts: string;
}

export interface PlayerDisconnectPayload {
  userId: number;
  ts: string;
}

export interface PlayerCustomPacketPayload {
  userId: number;
  type: string;
  content: Record<string, unknown>;
  ts: string;
}

export const TOPIC_PLAYER_CONNECT = "player.connect";
export const TOPIC_PLAYER_DISCONNECT = "player.disconnect";
export const TOPIC_PLAYER_CUSTOM_PACKET = "player.customPacket";
export const TOPIC_AUDIT = "audit";

export const KNOWN_TOPICS = new Set<string>([
  TOPIC_PLAYER_CONNECT,
  TOPIC_PLAYER_DISCONNECT,
  TOPIC_PLAYER_CUSTOM_PACKET,
  TOPIC_AUDIT,
]);
