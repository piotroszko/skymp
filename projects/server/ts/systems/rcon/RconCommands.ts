import type { ScampServer } from "../../scampNative";
import { getAggregatedMetrics } from "../metricsSystem";
import { SystemContext } from "../system";
import { RconError } from "./RconTypes";

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

async function playersList(
  ctx: SystemContext,
  _args: Record<string, unknown>,
  runtime: RconRuntime,
): Promise<unknown> {
  const svr = ctx.svr as ScampServer;
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
  safeCall(() => (ctx.svr as ScampServer).kick(userId));
  return { kicked: true, userId, reason: reason ?? null };
}

async function mpGet(
  ctx: SystemContext,
  args: Record<string, unknown>,
  _runtime: RconRuntime,
): Promise<unknown> {
  const formId = getNumber(args, "formId");
  const propertyName = getString(args, "propertyName");
  return safeCall(() =>
    (ctx.svr as unknown as { get: (formId: number, name: string) => unknown }).get(
      formId,
      propertyName,
    ),
  );
}

async function mpSet(
  ctx: SystemContext,
  args: Record<string, unknown>,
  _runtime: RconRuntime,
): Promise<unknown> {
  const formId = getNumber(args, "formId");
  const propertyName = getString(args, "propertyName");
  const value = args["value"];
  safeCall(() =>
    (
      ctx.svr as unknown as {
        set: (formId: number, name: string, value: unknown) => void;
      }
    ).set(formId, propertyName, value),
  );
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
      (ctx.svr as ScampServer).sendCustomPacket(userId, payload);
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
