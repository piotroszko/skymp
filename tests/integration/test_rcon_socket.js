const assert = require("node:assert");
const http = require("node:http");
const path = require("node:path");

const HOST = "127.0.0.1";
const PORT = 7793;
const KEY = "integration-key-do-not-use-in-prod";

// CWD when run by the integration runner is build/dist/server.
// Repo root is three levels up; socket.io-client lives in the workspace
// root node_modules thanks to yarn workspaces hoisting.
const repoRoot = path.resolve(process.cwd(), "..", "..", "..");
const socketIoClientPath = path.join(repoRoot, "node_modules", "socket.io-client");
// eslint-disable-next-line import/no-dynamic-require
const { io } = require(socketIoClientPath);

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const buf = Buffer.concat(chunks).toString("utf8");
        resolve({ status: res.statusCode, body: buf });
      });
    });
    req.on("error", reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

async function waitForServer(maxAttempts = 50, delayMs = 200) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await request({
        host: HOST,
        port: PORT,
        path: "/healthz",
        method: "GET",
      });
      if (res.status === 200) {
        return;
      }
    } catch {
      // not ready
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error(`Rcon server did not become ready on ${HOST}:${PORT}`);
}

function exec(verb, args) {
  return request(
    {
      host: HOST,
      port: PORT,
      path: "/exec",
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Rcon ${KEY}`,
      },
    },
    JSON.stringify({ verb, args, requestId: `rid-${verb}` }),
  );
}

function connect(token) {
  return new Promise((resolve, reject) => {
    const socket = io(`ws://${HOST}:${PORT}/rcon`, {
      auth: { token },
      transports: ["websocket"],
      reconnection: false,
      timeout: 5000,
    });
    socket.once("connect", () => resolve(socket));
    socket.once("connect_error", (err) => reject(err));
  });
}

function waitForEvent(socket, topic, predicate, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(topic, handler);
      reject(new Error(`Timed out waiting for ${topic} event`));
    }, timeoutMs);
    function handler(payload) {
      if (predicate(payload)) {
        clearTimeout(timer);
        socket.off(topic, handler);
        resolve(payload);
      }
    }
    socket.on(topic, handler);
  });
}

async function expectConnectError(token) {
  let caught = null;
  try {
    const sock = await connect(token);
    sock.disconnect();
  } catch (err) {
    caught = err;
  }
  assert.ok(caught, "Expected connect to fail");
}

const main = async () => {
  await waitForServer();

  // Bad token gets rejected by the namespace auth middleware.
  await expectConnectError("wrong-token");

  // Good token connects.
  const socket = await connect(KEY);
  try {
    socket.emit("subscribe", ["audit", "player.connect"]);
    // Give the server a tick to process subscribe.
    await new Promise((r) => setTimeout(r, 50));

    const auditPromise = waitForEvent(
      socket,
      "audit",
      (entry) => entry.verb === "metrics.snapshot" && entry.requestId === "rid-metrics.snapshot",
      5000,
    );

    const execRes = await exec("metrics.snapshot", {});
    assert.equal(execRes.status, 200);

    const auditEntry = await auditPromise;
    assert.equal(auditEntry.ok, true);
    assert.equal(auditEntry.verb, "metrics.snapshot");
    assert.ok(typeof auditEntry.ts === "string");
    assert.ok(typeof auditEntry.durationMs === "number");

    // Unsubscribe and confirm no further audit deliveries.
    socket.emit("unsubscribe", ["audit"]);
    await new Promise((r) => setTimeout(r, 50));
    let leakedAudit = false;
    const leakHandler = () => {
      leakedAudit = true;
    };
    socket.on("audit", leakHandler);
    await exec("metrics.snapshot", {});
    await new Promise((r) => setTimeout(r, 200));
    socket.off("audit", leakHandler);
    assert.equal(leakedAudit, false, "audit event leaked after unsubscribe");
  } finally {
    socket.disconnect();
  }
};

main()
  .then(() => {
    console.log("Test passed!");
    process.exit(0);
  })
  .catch((err) => {
    console.log("Test failed!");
    console.error(err);
    process.exit(1);
  });
