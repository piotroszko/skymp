# Rcon Service

The Rcon Service is a thin remote-control surface for the SkyMP server. It exposes a REST endpoint for one-shot commands and a Socket.IO namespace for live event streaming. It is intended to be driven by an external web admin panel that owns operator authentication, RBAC, audit UI, and history. The server side is intentionally minimal: a single shared key, an IP allowlist, a verb whitelist, and a per-IP rate limit.

## Configuration

Add an `rcon` block to `server-settings.json`:

```json5
{
  // ...
  "rcon": {
    "enabled": true,
    "port": 7790,
    "listenHost": "127.0.0.1",
    "key": "REPLACE-WITH-LONG-RANDOM-SECRET",
    "ipAllowlist": ["127.0.0.1/32", "::1/128"],
    "maxBodyBytes": 65536,
    "socketQueueMax": 1000,
    "pingIntervalMs": 25000,
    "pingTimeoutMs": 20000,
    "enableCustomPacketTopic": false,
    "rateLimit": {
      "burst": 40,
      "disable": false
    },
    "auditMaxBytesPerFile": 16777216
  }
}
```

| field | default | meaning |
|---|---|---|
| `enabled` | `false` | Master switch. When `false`, the service does not listen and has no impact. |
| `port` | `7790` | TCP port for both REST and Socket.IO. |
| `listenHost` | `127.0.0.1` | Bind address. Keep on loopback unless the machine is behind a trusted reverse proxy. |
| `key` | required when `enabled` | Shared bearer key. Must be non-empty. Provide via secret storage in production. |
| `ipAllowlist` | `["127.0.0.1/32", "::1/128"]` | CIDR ranges or exact addresses permitted to access the service. |
| `maxBodyBytes` | `65536` | Maximum request body size in bytes. |
| `socketQueueMax` | `1000` | Per-client socket outbound queue cap. |
| `pingIntervalMs` | `25000` | Socket.IO heartbeat interval. |
| `pingTimeoutMs` | `20000` | Socket.IO heartbeat timeout. |
| `enableCustomPacketTopic` | `false` | If `true`, the high-volume `player.customPacket` topic is emitted. Off by default. |
| `rateLimit.burst` | `40` | Maximum requests per source IP per 1-second window. Counts every request, including 401s. |
| `rateLimit.disable` | `false` | Set to `true` to bypass the rate-limit middleware entirely. |
| `auditMaxBytesPerFile` | `16777216` (16 MiB) | When the current audit file passes this size, the next write rolls over to a new index suffix. |

## TLS

The Rcon Service does not terminate TLS. Run the server behind a reverse proxy (nginx, Caddy, or similar) for any deployment outside loopback. The proxy is also a good place to add an additional auth layer.

## Rate limiting

Each request to `/exec` is counted by source IP in a 1-second sliding window. When a source exceeds `rateLimit.burst`, the server replies with HTTP 429 and the response body:

```json
{ "ok": false, "error": { "code": "rate_limited", "message": "rate limit exceeded" } }
```

Responses include `X-RateLimit-Remaining`, `X-RateLimit-Reset`, and `X-RateLimit-Limit` headers so the panel can pace itself. `/healthz` is exempt from rate limiting.

Set `rateLimit.disable: true` to skip the middleware in development.

## Authentication

A single shared key is used for both REST and Socket.IO.

REST: send `Authorization: Rcon <key>` on every request to `/exec`. `/healthz` does not require auth.

Socket.IO: pass `auth: { token: "<key>" }` on `io(...)` connect.

The key is compared in constant time. The IP allowlist is applied before the key check on both channels; the rate limiter sits between the IP allowlist and the bearer check. Failures are counted in `rcon_auth_failures_total{channel,reason}` (`reason` includes `bad_ip`, `bad_key`, `rate_limited`, etc.).

## REST surface

`POST /exec`

Request body:
```json
{
  "verb": "<verb name>",
  "args": { /* verb-specific */ },
  "requestId": "<optional uuid>"
}
```

Successful response:
```json
{ "ok": true, "requestId": "...", "result": <unknown> }
```

Failure response:
```json
{ "ok": false, "requestId": "...", "error": { "code": "<code>", "message": "<human readable>" } }
```

Status codes: `bad_auth` → 401, `bad_request` → 400, `not_connected` → 404, `not_found` → 404, `rate_limited` → 429, `internal` → 500.

`GET /healthz` — returns `{ ok: true, uptime, clientsConnected }`. No auth.

### Verbs

| verb | args | result |
|---|---|---|
| `players.list` | `{}` | `[{ userId, actorId, name, ip, guid }]` for each connected player. |
| `player.kick` | `{ userId, reason? }` | `{ kicked: true, userId, reason }` |
| `player.teleport` | `{ userId, pos: [x,y,z], cellOrWorldDesc, rot?: [x,y,z] }` | `{ teleported: true, userId, actorId, pos, rot, cellOrWorldDesc }`. If `rot` is omitted, the current rotation is preserved. |
| `player.inventory.get` | `{ userId }` | `{ userId, actorId, inventory: { entries: InventoryEntry[] } }` |
| `player.inventory.set` | `{ userId, inventory: { entries: InventoryEntry[] } }` | `{ ok: true, userId, actorId, entryCount }` |
| `world.snapshot` | `{}` | `{ playerCount, players: [{ userId, actorId, name, ip, guid, pos, cellOrWorldDesc }] }`. Strict superset of `players.list`; reads `locationalData` per player so it is more expensive. |
| `mp.get` | `{ formId, propertyName }` | The property value. |
| `mp.set` | `{ formId, propertyName, value }` | `{ ok: true }` |
| `chat.broadcast` | `{ text, color? }` | `{ delivered: <int> }` — sends a `systemMessage` custom packet to every connected user. |
| `metrics.snapshot` | `{}` | `{ format: "prometheus", text: "<...>" }` — same content as the existing `/metrics` endpoint. |

Unknown verbs are rejected with `bad_request`.

`InventoryEntry` shape:
```ts
interface InventoryEntry {
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
```

## Socket.IO surface

Namespace: `/rcon`. Topics are Socket.IO rooms.

Client → server:
- `subscribe(topics: string[])` — joins the listed rooms.
- `unsubscribe(topics: string[])` — leaves them.

Server → client topics:

| topic | payload | source |
|---|---|---|
| `player.connect` | `{ userId, ip, ts }` | when the server emits a connect event |
| `player.disconnect` | `{ userId, ts }` | when the server emits a disconnect event |
| `player.customPacket` | `{ userId, type, content, ts }` | only when `enableCustomPacketTopic` is `true` |
| `gamemode.error` | `{ kind, message, stack, ts }` | `process.uncaughtException` and `process.unhandledRejection`. `kind` reflects which fired. |
| `player.chat` | `{ userId, text, channel?, ts }` | when something emits `ctx.gm.emit("chat", payload)`. No-op until the gamemode publishes chat events. |
| `audit` | `{ ts, actor, verb, args, ok, durationMs, requestId, error? }` | every `/exec` call |

Unknown topic names are silently ignored on subscribe.

## Audit log

Every `/exec` call produces an audit line written to `${dataDir}/rcon-audit/YYYY-MM-DD.<idx>.jsonl`. The same entry is broadcast to the `audit` Socket.IO topic. Audit writes are asynchronous and never block the response.

### Rollover

When the active file's size passes `auditMaxBytesPerFile` (default 16 MiB), the next entry rolls forward to the next index: `2026-05-06.0.jsonl` → `2026-05-06.1.jsonl` → `2026-05-06.2.jsonl` …

A small overshoot is possible because the size check happens before the next write rather than mid-write. Acceptable.

For backwards compatibility with day-1 deployments, if a legacy file `YYYY-MM-DD.jsonl` (no index) already exists, it is treated as `idx=0` and continues to receive writes until it passes the cap; the first rollover then creates `YYYY-MM-DD.1.jsonl`.

External log rotation is still recommended if total disk usage is a concern.

## Metrics

The following Prometheus metrics are added to the existing registry served on the main `/metrics` endpoint:

- `rcon_exec_total{verb, result}` — counter
- `rcon_exec_duration_seconds{verb}` — histogram
- `rcon_socket_events_total{topic}` — counter
- `rcon_socket_dropped_total{reason}` — counter
- `rcon_clients_connected` — gauge
- `rcon_auth_failures_total{channel, reason}` — counter (reason includes `bad_ip`, `bad_key`, `rate_limited`)

## Performance

Lifecycle hooks (connect/disconnect/customPacket) only push events to an in-process bounded ring buffer. The ring is drained off the tick loop on a 10 ms timer. JSON serialization and Socket.IO emission run during the drain, never inside the tick. The `chat.broadcast` verb iterates a small `Set<number>` of currently connected user IDs maintained by the same hooks, so it does not scan world forms.

The `player.customPacket` topic is the only high-volume stream. It is opt-in via `enableCustomPacketTopic` to keep the default footprint negligible.

## CI

The integration tests under `tests/integration/test_rcon_*.js` are picked up by the existing CMake glob (`CMakeLists.txt:275`) and run by the `linux-build.yml` workflow's `ctest -C RelWithDebInfo --verbose --output-on-failure` step. New rcon tests dropped into that directory are gated automatically — no workflow edits required.

## Operational notes

- The service does not handle TLS; place it behind a reverse proxy in any non-loopback deployment.
- The bearer key cannot be rotated at runtime in this version. Restart the server to change it.
- The service has no built-in HMAC signing in this version. Bearer + IP allowlist is the supported model.
- Rate limit headers (`X-RateLimit-*`) are emitted on every request that passed the IP allowlist; honor them in the panel client to avoid 429 churn.
- Process-level `uncaughtException` and `unhandledRejection` handlers are installed when the service starts; the rest of the server already attaches its own handlers, and Node multiplexes — both fire.
