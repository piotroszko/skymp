const assert = require("node:assert");
const http = require("node:http");

const HOST = "127.0.0.1";
const PORT = 7792;
const KEY = "integration-key-do-not-use-in-prod";

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

const main = async () => {
  await waitForServer();

  const playersRes = await exec("players.list", {});
  assert.equal(playersRes.status, 200);
  const playersBody = JSON.parse(playersRes.body);
  assert.equal(playersBody.ok, true);
  assert.equal(playersBody.requestId, "rid-players.list");
  assert.ok(Array.isArray(playersBody.result));
  assert.equal(playersBody.result.length, 0);

  const broadcastRes = await exec("chat.broadcast", { text: "hello", color: "ff0000" });
  assert.equal(broadcastRes.status, 200);
  const broadcastBody = JSON.parse(broadcastRes.body);
  assert.equal(broadcastBody.ok, true);
  assert.equal(broadcastBody.result.delivered, 0);

  const metricsRes = await exec("metrics.snapshot", {});
  assert.equal(metricsRes.status, 200);
  const metricsBody = JSON.parse(metricsRes.body);
  assert.equal(metricsBody.ok, true);
  assert.ok(metricsBody.result.text.includes("rcon_exec_total"));

  const unknownRes = await exec("unknown.verb", {});
  assert.equal(unknownRes.status, 400);
  const unknownBody = JSON.parse(unknownRes.body);
  assert.equal(unknownBody.ok, false);
  assert.equal(unknownBody.error.code, "bad_request");

  const badArgsRes = await exec("player.kick", {});
  assert.equal(badArgsRes.status, 400);
  const badArgsBody = JSON.parse(badArgsRes.body);
  assert.equal(badArgsBody.ok, false);
  assert.equal(badArgsBody.error.code, "bad_request");
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
