// Boots the server in-process and exercises the whole flow end to end.
process.env.JWT_SECRET = "testsecret";
process.env.PORT = "3999";
const WebSocket = require("ws");
const { server } = require("./server");

const BASE = "http://localhost:3999";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function post(p, body, token) {
  const r = await fetch(BASE + p, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
    body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

(async () => {
  await sleep(600);
  let pass = 0, fail = 0;
  const ok = (name, cond) => { if (cond) { pass++; console.log("  PASS " + name); } else { fail++; console.log("  FAIL " + name); } };

  const a = await post("/api/signup", { email: "a@test.com", password: "pw123", name: "Alice", lang: "EN" });
  ok("signup A returns token", a.status === 200 && !!a.body.token);
  const b = await post("/api/signup", { email: "b@test.com", password: "pw123", name: "Bruno", lang: "DE" });
  ok("signup B returns token", b.status === 200 && !!b.body.token);
  const dup = await post("/api/signup", { email: "a@test.com", password: "pw123", name: "Alice", lang: "EN" });
  ok("duplicate signup -> 409", dup.status === 409);
  const lg = await post("/api/login", { email: "a@test.com", password: "pw123" });
  ok("login good -> 200 + token", lg.status === 200 && !!lg.body.token);
  const lb = await post("/api/login", { email: "a@test.com", password: "nope" });
  ok("login wrong pw -> 401", lb.status === 401);
  const noauth = await fetch(BASE + "/api/messages").then((r) => r.status);
  ok("messages without token -> 401", noauth === 401);
  const withauth = await fetch(BASE + "/api/messages", { headers: { Authorization: "Bearer " + a.body.token } });
  const wj = await withauth.json();
  ok("messages with token -> 200 + empty", withauth.status === 200 && Array.isArray(wj.messages) && wj.messages.length === 0);

  const wsB = new WebSocket("ws://localhost:3999/ws?token=" + b.body.token);
  const received = [];
  await new Promise((res, rej) => { wsB.on("open", res); wsB.on("error", rej); });
  wsB.on("message", (d) => received.push(JSON.parse(d.toString())));
  const wsA = new WebSocket("ws://localhost:3999/ws?token=" + a.body.token);
  await new Promise((res, rej) => { wsA.on("open", res); wsA.on("error", rej); });
  wsA.send(JSON.stringify({ type: "send", text: "Hello team" }));
  await sleep(500);
  ok("B receives A's message live over WS", received.some((m) => m.type === "message" && m.message.text === "Hello team" && m.message.sender_name === "Alice"));

  const hist = await fetch(BASE + "/api/messages", { headers: { Authorization: "Bearer " + a.body.token } }).then((r) => r.json());
  ok("message persisted to history", hist.messages.length === 1 && hist.messages[0].text === "Hello team");

  // Bad-token socket: it completes the TCP handshake (unavoidable) but must be
  // closed by the server before it can send/receive. We wait for the close event.
  const bad = new WebSocket("ws://localhost:3999/ws?token=garbage");
  const badClosed = await new Promise((res) => {
    bad.on("close", (code) => res(code === 4001));
    setTimeout(() => res(false), 1500);
  });
  ok("WS with bad token closed (code 4001)", badClosed === true);

  console.log("\n  " + pass + " passed, " + fail + " failed");
  server.close();
  process.exit(fail === 0 ? 0 : 1);
})();
