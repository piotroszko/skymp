# Rcon Service

The Rcon Service is a thin remote-control surface for the SkyMP server. It exposes a REST endpoint for one-shot commands and a Socket.IO namespace for live event streaming. It is intended to be driven by an external web admin panel that owns operator authentication, RBAC, audit UI, and history. The server side is intentionally minimal: a single shared key, an IP allowlist, and a verb whitelist.

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
    "enableCustomPacketTopic": false
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

## TLS

The Rcon Service does not terminate TLS. Run the server behind a reverse proxy (nginx, Caddy, or similar) for any deployment outside loopback. The proxy is also a good place to add an additional auth layer.

## Authentication

A single shared key is used for both REST and Socket.IO.

REST: send `Authorization: Rcon <key>` on every request to `/exec`. `/healthz` does not require auth.

Socket.IO: pass `auth: { token: "<key>" }` on `io(...)` connect.

The key is compared in constant time. The IP allowlist is applied before the key check on both channels. Failures are counted in `rcon_auth_failures_total{channel,reason}`.

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

Status codes: `bad_auth` → 401, `bad_request` → 400, `not_connected` → 404, `not_found` → 404, `internal` → 500.

`GET /healthz` — returns `{ ok: true, uptime, clientsConnected }`. No auth.

### Verbs (day 1)

| verb | args | result |
|---|---|---|
| `players.list` | `{}` | `[{ userId, actorId, name, ip, guid }]` for each connected player. |
| `player.kick` | `{ userId, reason? }` | `{ kicked: true, userId, reason }` |
| `mp.get` | `{ formId, propertyName }` | The property value. |
| `mp.set` | `{ formId, propertyName, value }` | `{ ok: true }` |
| `chat.broadcast` | `{ text, color? }` | `{ delivered: <int> }` — sends a `systemMessage` custom packet to every connected user. |
| `metrics.snapshot` | `{}` | `{ format: "prometheus", text: "<...>" }` — same content as the existing `/metrics` endpoint. |

Unknown verbs are rejected with `bad_request`.

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
| `audit` | `{ ts, actor, verb, args, ok, durationMs, requestId, error? }` | every `/exec` call |

Unknown topic names are silently ignored on subscribe.

## Audit log

Every `/exec` call produces an audit line written to `${dataDir}/rcon-audit/YYYY-MM-DD.jsonl`. The same entry is broadcast to the `audit` Socket.IO topic. Audit writes are asynchronous and never block the response.

## Metrics

The following Prometheus metrics are added to the existing registry served on the main `/metrics` endpoint:

- `rcon_exec_total{verb, result}` — counter
- `rcon_exec_duration_seconds{verb}` — histogram
- `rcon_socket_events_total{topic}` — counter
- `rcon_socket_dropped_total{reason}` — counter
- `rcon_clients_connected` — gauge
- `rcon_auth_failures_total{channel, reason}` — counter

## Performance

Lifecycle hooks (connect/disconnect/customPacket) only push events to an in-process bounded ring buffer. The ring is drained off the tick loop on a 10 ms timer. JSON serialization and Socket.IO emission run during the drain, never inside the tick. The `chat.broadcast` verb iterates a small `Set<number>` of currently connected user IDs maintained by the same hooks, so it does not scan world forms.

The `player.customPacket` topic is the only high-volume stream. It is opt-in via `enableCustomPacketTopic` to keep the default footprint negligible.

## Operational notes

- The service does not handle TLS; place it behind a reverse proxy in any non-loopback deployment.
- The bearer key cannot be rotated at runtime in this version. Restart the server to change it.
- The service has no built-in HMAC signing or rate limiting in this version. Both are documented as planned follow-ups.
- Audit log files are not rotated past daily filenames. Use external log rotation if disk usage is a concern.
