const assert = require("node:assert");
const http = require("node:http");

const HOST = "127.0.0.1";
const PORT = 7794;
const KEY = "integration-key-do-not-use-in-prod";

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const buf = Buffer.concat(chunks).toString("utf8");
        resolve({ status: res.statusCode, body: buf, headers: res.headers });
      });
    });
    req.on("error", reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

function exec() {
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
    JSON.stringify({ verb: "metrics.snapshot" }),
  );
}

async function waitForServer(maxAttempts = 50, delayMs = 200) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await request({ host: HOST, port: PORT, path: "/healthz", method: "GET" });
      if (res.status === 200) return;
    } catch {
      // not ready
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error(`Rcon server did not become ready on ${HOST}:${PORT}`);
}

const main = async () => {
  await waitForServer();

  // Burst: send 10 requests immediately. With burst:5 we expect at least one 429.
  const burst = await Promise.all(Array.from({ length: 10 }, () => exec()));
  const okCount = burst.filter((r) => r.status === 200).length;
  const rateLimited = burst.filter((r) => r.status === 429);
  assert.ok(okCount >= 1, `expected at least 1 successful response, got ${okCount}`);
  assert.ok(
    rateLimited.length >= 1,
    `expected at least 1 rate-limited response, got ${rateLimited.length}`,
  );
  for (const r of rateLimited) {
    const parsed = JSON.parse(r.body);
    assert.equal(parsed.ok, false);
    assert.equal(parsed.error.code, "rate_limited");
  }

  // Wait past the 1s window and verify recovery.
  await new Promise((r) => setTimeout(r, 1200));
  const recovered = await exec();
  assert.equal(recovered.status, 200, `expected recovery, got ${recovered.status}: ${recovered.body}`);

  // Healthz remains exempt.
  const health = await request({ host: HOST, port: PORT, path: "/healthz", method: "GET" });
  assert.equal(health.status, 200);
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
