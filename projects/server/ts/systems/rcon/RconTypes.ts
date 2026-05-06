export type RconErrorCode =
  | "bad_auth"
  | "bad_request"
  | "not_connected"
  | "not_found"
  | "rate_limited"
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

export interface GamemodeErrorPayload {
  kind: "uncaughtException" | "unhandledRejection";
  message: string;
  stack: string | null;
  ts: string;
}

export interface PlayerChatPayload {
  userId: number;
  text: string;
  channel?: string;
  ts: string;
}

export interface InventoryEntry {
  baseId: number;
  count: number;
  health?: number;
  enchantmentId?: number;
  maxCharge?: number;
  chargePercent?: number;
  name?: string;
  soul?: number;
  poisonId?: number;
  poisonCount?: number;
  worn?: boolean;
  wornLeft?: boolean;
}

export interface InventoryPayload {
  entries: InventoryEntry[];
}

export interface WorldSnapshotEntry {
  userId: number;
  actorId: number | null;
  name: string | null;
  ip: string | null;
  guid: string | null;
  pos: number[] | null;
  cellOrWorldDesc: string | null;
}

export interface WorldSnapshot {
  playerCount: number;
  players: WorldSnapshotEntry[];
}

export const TOPIC_PLAYER_CONNECT = "player.connect";
export const TOPIC_PLAYER_DISCONNECT = "player.disconnect";
export const TOPIC_PLAYER_CUSTOM_PACKET = "player.customPacket";
export const TOPIC_GAMEMODE_ERROR = "gamemode.error";
export const TOPIC_PLAYER_CHAT = "player.chat";
export const TOPIC_AUDIT = "audit";

export const KNOWN_TOPICS = new Set<string>([
  TOPIC_PLAYER_CONNECT,
  TOPIC_PLAYER_DISCONNECT,
  TOPIC_PLAYER_CUSTOM_PACKET,
  TOPIC_GAMEMODE_ERROR,
  TOPIC_PLAYER_CHAT,
  TOPIC_AUDIT,
]);
