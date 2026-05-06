const assert = require("node:assert");
const http = require("node:http");

const HOST = "127.0.0.1";
const PORT = 7791;
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
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error(`Rcon server did not become ready on ${HOST}:${PORT}`);
}

const main = async () => {
  await waitForServer();

  const noAuth = await request(
    {
      host: HOST,
      port: PORT,
      path: "/exec",
      method: "POST",
      headers: { "content-type": "application/json" },
    },
    JSON.stringify({ verb: "metrics.snapshot" }),
  );
  assert.equal(noAuth.status, 401, `Expected 401 without auth, got ${noAuth.status}`);

  const wrongAuth = await request(
    {
      host: HOST,
      port: PORT,
      path: "/exec",
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Rcon wrong-key",
      },
    },
    JSON.stringify({ verb: "metrics.snapshot" }),
  );
  assert.equal(wrongAuth.status, 401, `Expected 401 with wrong key, got ${wrongAuth.status}`);

  const goodAuth = await request(
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
    JSON.stringify({ verb: "metrics.snapshot" }),
  );
  assert.equal(goodAuth.status, 200, `Expected 200 with good key, got ${goodAuth.status}: ${goodAuth.body}`);
  const goodBody = JSON.parse(goodAuth.body);
  assert.equal(goodBody.ok, true);
  assert.equal(goodBody.result.format, "prometheus");
  assert.ok(typeof goodBody.result.text === "string" && goodBody.result.text.length > 0);

  const healthRes = await request({
    host: HOST,
    port: PORT,
    path: "/healthz",
    method: "GET",
  });
  assert.equal(healthRes.status, 200);
  const health = JSON.parse(healthRes.body);
  assert.equal(health.ok, true);
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
