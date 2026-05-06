import type { ScampServer } from "../../scampNative";
import { getAggregatedMetrics } from "../metricsSystem";
import { SystemContext } from "../system";
import {
  InventoryPayload,
  RconError,
  WorldSnapshot,
  WorldSnapshotEntry,
} from "./RconTypes";

export interface RconRuntime {
  connectedUserIds: Set<number>;
}

export type RconHandler = (
  ctx: SystemContext,
  args: Record<string, unknown>,
  runtime: RconRuntime,
) => Promise<unknown>;

export const handlers: Record<string, RconHandler> = {
  "players.list": playersList,
  "player.kick": playerKick,
  "player.teleport": playerTeleport,
  "player.inventory.get": playerInventoryGet,
  "player.inventory.set": playerInventorySet,
  "world.snapshot": worldSnapshot,
  "mp.get": mpGet,
  "mp.set": mpSet,
  "chat.broadcast": chatBroadcast,
  "metrics.snapshot": metricsSnapshot,
};

export async function dispatch(
  verb: string,
  args: Record<string, unknown>,
  ctx: SystemContext,
  runtime: RconRuntime,
): Promise<unknown> {
  const handler = handlers[verb];
  if (!handler) {
    throw new RconError("bad_request", `Unknown verb: ${verb}`);
  }
  return await handler(ctx, args, runtime);
}

function getNumber(args: Record<string, unknown>, key: string): number {
  const value = args[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new RconError("bad_request", `Argument "${key}" must be a finite number`);
  }
  return value;
}

function getString(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  if (typeof value !== "string") {
    throw new RconError("bad_request", `Argument "${key}" must be a string`);
  }
  return value;
}

function getOptionalString(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new RconError("bad_request", `Argument "${key}" must be a string when present`);
  }
  return value;
}

function getNumberTriple(args: Record<string, unknown>, key: string): [number, number, number] {
  const value = args[key];
  if (
    !Array.isArray(value) ||
    value.length !== 3 ||
    !value.every((v) => typeof v === "number" && Number.isFinite(v))
  ) {
    throw new RconError(
      "bad_request",
      `Argument "${key}" must be an array of 3 finite numbers`,
    );
  }
  return [value[0] as number, value[1] as number, value[2] as number];
}

function getOptionalNumberTriple(
  args: Record<string, unknown>,
  key: string,
): [number, number, number] | undefined {
  if (args[key] === undefined || args[key] === null) {
    return undefined;
  }
  return getNumberTriple(args, key);
}

function remapNativeError(err: unknown): RconError {
  if (err instanceof RconError) {
    return err;
  }
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();
  if (lower.includes("not connected") || lower.includes("not in connected state")) {
    return new RconError("not_connected", message);
  }
  if (lower.includes("doesn't exist") || lower.includes("not found") || lower.includes("no such")) {
    return new RconError("not_found", message);
  }
  return new RconError("internal", message);
}

function safeCall<T>(fn: () => T): T {
  try {
    return fn();
  } catch (err) {
    throw remapNativeError(err);
  }
}

function resolveActorIdForUser(svr: ScampServer, userId: number): number {
  let actorId: number;
  try {
    actorId = svr.getUserActor(userId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new RconError("not_connected", `userId ${userId} has no associated actor: ${message}`);
  }
  if (!actorId || actorId === 0) {
    throw new RconError("not_connected", `userId ${userId} has no associated actor`);
  }
  return actorId;
}

async function playersList(
  ctx: SystemContext,
  _args: Record<string, unknown>,
  runtime: RconRuntime,
): Promise<unknown> {
  const svr = ctx.svr;
  const out: Array<{
    userId: number;
    actorId: number | null;
    name: string | null;
    ip: string | null;
    guid: string | null;
  }> = [];
  for (const userId of runtime.connectedUserIds) {
    let actorId: number | null = null;
    let name: string | null = null;
    let ip: string | null = null;
    let guid: string | null = null;
    try {
      actorId = svr.getUserActor(userId);
    } catch {
      actorId = null;
    }
    if (actorId !== null && actorId !== 0) {
      try {
        name = svr.getActorName(actorId);
      } catch {
        name = null;
      }
    }
    try {
      ip = svr.getUserIp(userId);
    } catch {
      ip = null;
    }
    try {
      guid = svr.getUserGuid(userId);
    } catch {
      guid = null;
    }
    out.push({ userId, actorId, name, ip, guid });
  }
  return out;
}

async function playerKick(
  ctx: SystemContext,
  args: Record<string, unknown>,
  _runtime: RconRuntime,
): Promise<unknown> {
  const userId = getNumber(args, "userId");
  const reason = getOptionalString(args, "reason");
  safeCall(() => ctx.svr.kick(userId));
  return { kicked: true, userId, reason: reason ?? null };
}

async function playerTeleport(
  ctx: SystemContext,
  args: Record<string, unknown>,
  _runtime: RconRuntime,
): Promise<unknown> {
  const userId = getNumber(args, "userId");
  const pos = getNumberTriple(args, "pos");
  const cellOrWorldDesc = getString(args, "cellOrWorldDesc");
  const explicitRot = getOptionalNumberTriple(args, "rot");

  const actorId = resolveActorIdForUser(ctx.svr, userId);

  let rot: [number, number, number];
  if (explicitRot) {
    rot = explicitRot;
  } else {
    const current = safeCall(() => ctx.svr.get(actorId, "locationalData")) as
      | { rot?: unknown }
      | null
      | undefined;
    if (
      current &&
      typeof current === "object" &&
      Array.isArray((current as { rot?: unknown }).rot) &&
      (current as { rot: unknown[] }).rot.length === 3 &&
      ((current as { rot: unknown[] }).rot as unknown[]).every(
        (v) => typeof v === "number" && Number.isFinite(v),
      )
    ) {
      const r = (current as { rot: number[] }).rot;
      rot = [r[0], r[1], r[2]];
    } else {
      rot = [0, 0, 0];
    }
  }

  const locationalData = { pos, rot, cellOrWorldDesc };
  safeCall(() => ctx.svr.set(actorId, "locationalData", locationalData));
  return { teleported: true, userId, actorId, pos, rot, cellOrWorldDesc };
}

async function playerInventoryGet(
  ctx: SystemContext,
  args: Record<string, unknown>,
  _runtime: RconRuntime,
): Promise<unknown> {
  const userId = getNumber(args, "userId");
  const actorId = resolveActorIdForUser(ctx.svr, userId);
  const inventory = safeCall(() => ctx.svr.get(actorId, "inventory"));
  return { userId, actorId, inventory };
}

async function playerInventorySet(
  ctx: SystemContext,
  args: Record<string, unknown>,
  _runtime: RconRuntime,
): Promise<unknown> {
  const userId = getNumber(args, "userId");
  const inventoryRaw = args["inventory"];
  if (!inventoryRaw || typeof inventoryRaw !== "object" || Array.isArray(inventoryRaw)) {
    throw new RconError("bad_request", `Argument "inventory" must be an object`);
  }
  const entries = (inventoryRaw as { entries?: unknown }).entries;
  if (!Array.isArray(entries)) {
    throw new RconError("bad_request", `Argument "inventory.entries" must be an array`);
  }
  const inventory = inventoryRaw as InventoryPayload;
  const actorId = resolveActorIdForUser(ctx.svr, userId);
  safeCall(() => ctx.svr.set(actorId, "inventory", inventory));
  return { ok: true, userId, actorId, entryCount: entries.length };
}

async function worldSnapshot(
  ctx: SystemContext,
  _args: Record<string, unknown>,
  runtime: RconRuntime,
): Promise<unknown> {
  const svr = ctx.svr;
  const players: WorldSnapshotEntry[] = [];
  for (const userId of runtime.connectedUserIds) {
    let actorId: number | null = null;
    let name: string | null = null;
    let ip: string | null = null;
    let guid: string | null = null;
    let pos: number[] | null = null;
    let cellOrWorldDesc: string | null = null;
    try {
      actorId = svr.getUserActor(userId);
    } catch {
      actorId = null;
    }
    if (actorId !== null && actorId !== 0) {
      try {
        name = svr.getActorName(actorId);
      } catch {
        // ignore
      }
      try {
        const located = svr.get(actorId, "locationalData") as
          | { pos?: unknown; cellOrWorldDesc?: unknown }
          | null
          | undefined;
        if (located && typeof located === "object") {
          if (Array.isArray((located as { pos?: unknown }).pos)) {
            pos = (located as { pos: unknown[] }).pos.filter(
              (v) => typeof v === "number" && Number.isFinite(v),
            ) as number[];
            if (pos.length !== 3) {
              pos = null;
            }
          }
          if (typeof (located as { cellOrWorldDesc?: unknown }).cellOrWorldDesc === "string") {
            cellOrWorldDesc = (located as { cellOrWorldDesc: string }).cellOrWorldDesc;
          }
        }
      } catch {
        // ignore
      }
    }
    try {
      ip = svr.getUserIp(userId);
    } catch {
      ip = null;
    }
    try {
      guid = svr.getUserGuid(userId);
    } catch {
      guid = null;
    }
    players.push({ userId, actorId, name, ip, guid, pos, cellOrWorldDesc });
  }
  const snapshot: WorldSnapshot = { playerCount: players.length, players };
  return snapshot;
}

async function mpGet(
  ctx: SystemContext,
  args: Record<string, unknown>,
  _runtime: RconRuntime,
): Promise<unknown> {
  const formId = getNumber(args, "formId");
  const propertyName = getString(args, "propertyName");
  return safeCall(() => ctx.svr.get(formId, propertyName));
}

async function mpSet(
  ctx: SystemContext,
  args: Record<string, unknown>,
  _runtime: RconRuntime,
): Promise<unknown> {
  const formId = getNumber(args, "formId");
  const propertyName = getString(args, "propertyName");
  const value = args["value"];
  safeCall(() => ctx.svr.set(formId, propertyName, value));
  return { ok: true };
}

async function chatBroadcast(
  ctx: SystemContext,
  args: Record<string, unknown>,
  runtime: RconRuntime,
): Promise<unknown> {
  const text = getString(args, "text");
  const color = getOptionalString(args, "color");
  const payload = JSON.stringify({
    customPacketType: "systemMessage",
    text,
    color: color ?? null,
  });
  let delivered = 0;
  for (const userId of runtime.connectedUserIds) {
    try {
      ctx.svr.sendCustomPacket(userId, payload);
      delivered++;
    } catch {
      // skip recipient on per-user failure
    }
  }
  return { delivered };
}

async function metricsSnapshot(
  ctx: SystemContext,
  _args: Record<string, unknown>,
  _runtime: RconRuntime,
): Promise<unknown> {
  const text = await getAggregatedMetrics(ctx.svr);
  return { format: "prometheus", text };
}
