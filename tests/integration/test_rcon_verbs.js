const assert = require("node:assert");
const http = require("node:http");

const HOST = "127.0.0.1";
const PORT = 7795;
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

  const snap = await exec("world.snapshot", {});
  assert.equal(snap.status, 200);
  const snapBody = JSON.parse(snap.body);
  assert.equal(snapBody.ok, true);
  assert.equal(snapBody.result.playerCount, 0);
  assert.deepEqual(snapBody.result.players, []);

  // Bogus userIds for the actor-bound verbs → 404 not_connected
  const teleport = await exec("player.teleport", {
    userId: 99999,
    pos: [0, 0, 0],
    cellOrWorldDesc: "1a26f:Skyrim.esm",
  });
  assert.equal(teleport.status, 404, `teleport: ${teleport.status}: ${teleport.body}`);
  assert.equal(JSON.parse(teleport.body).error.code, "not_connected");

  const invGet = await exec("player.inventory.get", { userId: 99999 });
  assert.equal(invGet.status, 404);
  assert.equal(JSON.parse(invGet.body).error.code, "not_connected");

  const invSet = await exec("player.inventory.set", {
    userId: 99999,
    inventory: { entries: [] },
  });
  assert.equal(invSet.status, 404);
  assert.equal(JSON.parse(invSet.body).error.code, "not_connected");

  // Argument validation
  const badPos = await exec("player.teleport", { userId: 99999, pos: [0, 0], cellOrWorldDesc: "x" });
  assert.equal(badPos.status, 400);
  assert.equal(JSON.parse(badPos.body).error.code, "bad_request");

  const badInv = await exec("player.inventory.set", { userId: 99999, inventory: { entries: "no" } });
  assert.equal(badInv.status, 400);
  assert.equal(JSON.parse(badInv.body).error.code, "bad_request");
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
