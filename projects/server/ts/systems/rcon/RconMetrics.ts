import * as promClient from "prom-client";

export const rconExecCounter = new promClient.Counter({
  name: "rcon_exec_total",
  help: "Total number of rcon /exec calls",
  labelNames: ["verb", "result"] as const,
});

export const rconExecDurationHistogram = new promClient.Histogram({
  name: "rcon_exec_duration_seconds",
  help: "Duration of rcon /exec call handling in seconds",
  labelNames: ["verb"] as const,
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
});

export const rconSocketEventsCounter = new promClient.Counter({
  name: "rcon_socket_events_total",
  help: "Total number of rcon socket events emitted",
  labelNames: ["topic"] as const,
});

export const rconSocketDroppedCounter = new promClient.Counter({
  name: "rcon_socket_dropped_total",
  help: "Total number of rcon socket events dropped",
  labelNames: ["reason"] as const,
});

export const rconClientsConnectedGauge = new promClient.Gauge({
  name: "rcon_clients_connected",
  help: "Number of currently connected rcon socket clients",
});

export const rconAuthFailuresCounter = new promClient.Counter({
  name: "rcon_auth_failures_total",
  help: "Total number of rcon auth failures",
  labelNames: ["channel", "reason"] as const,
});
