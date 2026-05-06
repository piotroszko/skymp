import { BlockList } from "net";

import { RconSettings } from "../../settings";
import { Log, SystemContext } from "../system";
import {
  KoaApp,
  KoaAppCtor,
  KoaBodyModule,
  KoaContext,
  KoaMiddleware,
  KoaNext,
  KoaRouter,
  KoaRouterCtor,
} from "./KoaShims";
import { ipAllowed, normalizeIp, verifyBearer } from "./RconAuth";
import { dispatch, RconRuntime } from "./RconCommands";
import { rconAuthFailuresCounter, rconExecCounter, rconExecDurationHistogram } from "./RconMetrics";
import { AuditEntry, RconError, RconExecRequest, RconExecResponse } from "./RconTypes";

const Koa = require("koa") as KoaAppCtor;
const Router = require("koa-router") as KoaRouterCtor;
const koaBody = require("koa-body") as KoaBodyModule;

const DEFAULT_MAX_BODY_BYTES = 65_536;

export interface RconRouterDeps {
  log: Log;
  getSettings: () => RconSettings | null;
  getBlockList: () => BlockList | null;
  runtime: RconRuntime;
  ctx: SystemContext;
  recordAudit: (entry: AuditEntry) => void;
  getClientsConnected: () => number;
}

export function buildRconApp(deps: RconRouterDeps): KoaApp {
  const app = new Koa();
  app.proxy = false;

  app.use(errorHandler(deps));
  app.use(ipAllowlistMiddleware(deps));
  app.use(bearerAuthMiddleware(deps));

  const maxBodyBytes = deps.getSettings()?.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
  const bodyFactory = koaBody.default ?? koaBody;
  app.use(bodyFactory({ jsonLimit: maxBodyBytes }));

  const router = new Router();
  registerHealthRoute(router, deps);
  registerExecRoute(router, deps);

  app.use(router.routes()).use(router.allowedMethods());
  return app;
}

function errorHandler(deps: RconRouterDeps): KoaMiddleware {
  return async (kctx: KoaContext, next: KoaNext) => {
    try {
      await next();
    } catch (err) {
      if (err instanceof RconError) {
        kctx.status = errorCodeToStatus(err.code);
        kctx.body = { ok: false, error: { code: err.code, message: err.message } };
        return;
      }
      const error = err instanceof Error ? err : new Error(String(err));
      deps.log(`RconService unhandled error: ${error.message}\n${error.stack ?? ""}`);
      kctx.status = 500;
      kctx.body = { ok: false, error: { code: "internal", message: "internal error" } };
    }
  };
}

function ipAllowlistMiddleware(deps: RconRouterDeps): KoaMiddleware {
  return async (kctx: KoaContext, next: KoaNext) => {
    const ip = normalizeIp(kctx.request.ip ?? "");
    const blockList = deps.getBlockList();
    if (!blockList || !ipAllowed(blockList, ip)) {
      rconAuthFailuresCounter.inc({ channel: "rest", reason: "bad_ip" });
      kctx.status = 403;
      kctx.body = { ok: false, error: { code: "bad_auth", message: "ip not allowed" } };
      return;
    }
    await next();
  };
}

function bearerAuthMiddleware(deps: RconRouterDeps): KoaMiddleware {
  return async (kctx: KoaContext, next: KoaNext) => {
    if (kctx.path === "/healthz") {
      await next();
      return;
    }
    const authorization = kctx.request.get("authorization");
    const key = deps.getSettings()?.key ?? "";
    if (!verifyBearer(authorization, key)) {
      rconAuthFailuresCounter.inc({ channel: "rest", reason: "bad_key" });
      kctx.status = 401;
      kctx.set("WWW-Authenticate", 'Rcon realm="rcon"');
      kctx.body = { ok: false, error: { code: "bad_auth", message: "invalid bearer" } };
      return;
    }
    await next();
  };
}

function registerHealthRoute(router: KoaRouter, deps: RconRouterDeps): void {
  router.get("/healthz", (kctx: KoaContext) => {
    kctx.body = {
      ok: true,
      uptime: process.uptime(),
      clientsConnected: deps.getClientsConnected(),
    };
  });
}

function registerExecRoute(router: KoaRouter, deps: RconRouterDeps): void {
  router.post("/exec", async (kctx: KoaContext) => {
    const body = (kctx.request.body ?? {}) as Partial<RconExecRequest>;
    const verb = typeof body.verb === "string" ? body.verb : "";
    const args =
      body.args && typeof body.args === "object" && !Array.isArray(body.args)
        ? (body.args as Record<string, unknown>)
        : {};
    const requestId = typeof body.requestId === "string" ? body.requestId : undefined;
    const actor = normalizeIp(kctx.request.ip ?? "");

    if (!verb) {
      rconExecCounter.inc({ verb: "<missing>", result: "bad_request" });
      const response: RconExecResponse = {
        ok: false,
        requestId,
        error: { code: "bad_request", message: "verb is required" },
      };
      kctx.status = 400;
      kctx.body = response;
      deps.recordAudit({
        ts: new Date().toISOString(),
        actor,
        verb,
        args,
        ok: false,
        durationMs: 0,
        requestId,
        error: response.error,
      });
      return;
    }

    const endTimer = rconExecDurationHistogram.startTimer({ verb });
    const startedAt = Date.now();
    try {
      const result = await dispatch(verb, args, deps.ctx, deps.runtime);
      endTimer();
      rconExecCounter.inc({ verb, result: "ok" });
      const response: RconExecResponse = { ok: true, requestId, result };
      kctx.body = response;
      deps.recordAudit({
        ts: new Date().toISOString(),
        actor,
        verb,
        args,
        ok: true,
        durationMs: Date.now() - startedAt,
        requestId,
      });
    } catch (err) {
      endTimer();
      const rconErr =
        err instanceof RconError
          ? err
          : new RconError("internal", err instanceof Error ? err.message : String(err));
      rconExecCounter.inc({ verb, result: rconErr.code });
      kctx.status = errorCodeToStatus(rconErr.code);
      const response: RconExecResponse = {
        ok: false,
        requestId,
        error: { code: rconErr.code, message: rconErr.message },
      };
      kctx.body = response;
      deps.recordAudit({
        ts: new Date().toISOString(),
        actor,
        verb,
        args,
        ok: false,
        durationMs: Date.now() - startedAt,
        requestId,
        error: response.error,
      });
    }
  });
}

function errorCodeToStatus(code: string): number {
  switch (code) {
    case "bad_auth":
      return 401;
    case "bad_request":
      return 400;
    case "not_connected":
    case "not_found":
      return 404;
    default:
      return 500;
  }
}
