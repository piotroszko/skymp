const assert = require("node:assert");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const HOST = "127.0.0.1";
const PORT = 7796;
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

function exec(verb, requestId) {
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
    JSON.stringify({ verb, requestId }),
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

  // CWD = build/dist/server. The server boots with dataDir from server-settings.json.
  // Read that file directly to discover the audit dir, rather than hard-coding.
  const settings = JSON.parse(fs.readFileSync("server-settings.json", "utf8"));
  const dataDir = settings.dataDir || "./data";
  const auditDir = path.join(dataDir, "rcon-audit");

  // Force enough writes to exceed the 1024-byte cap multiple times.
  for (let i = 0; i < 80; i++) {
    const res = await exec("metrics.snapshot", `rid-${i}`);
    assert.equal(res.status, 200, `iter ${i}: ${res.status}: ${res.body}`);
  }

  // Allow the async audit queue to drain.
  await new Promise((r) => setTimeout(r, 1000));

  // Today in UTC, matching RconAudit's slice(0, 10) on entry.ts (which is toISOString).
  const today = new Date().toISOString().slice(0, 10);
  const files = fs.readdirSync(auditDir).filter((name) => name.startsWith(today));
  // Expect at least .0 and .1 (or legacy + .1).
  const indexed = files.filter((name) => /\.\d+\.jsonl$/.test(name));
  const legacy = files.filter((name) => name === `${today}.jsonl`);

  assert.ok(
    indexed.length >= 1 || legacy.length >= 1,
    `no audit files for today found in ${auditDir}: ${files.join(", ")}`,
  );

  const totalRolls = indexed.length + legacy.length;
  assert.ok(
    totalRolls >= 2,
    `expected rollover (>=2 files) for today, got ${totalRolls}: ${files.join(", ")}`,
  );

  for (const name of files) {
    const stat = fs.statSync(path.join(auditDir, name));
    assert.ok(stat.size > 0, `file ${name} is empty`);
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
