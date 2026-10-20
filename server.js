// CommonTongue backend — Express + WebSocket, owns auth, messages, realtime
// and translation. No hosted backend service: everything here is our own code,
// backed by a local SQLite file.
const fs = require("fs");
const express = require("express");
const http = require("http");
const path = require("path");

// Load variables from a local .env file into process.env (no dependency needed).
// Lines look like KEY=value; blank lines and # comments are ignored.
(function loadEnv() {
  try {
    const file = path.join(__dirname, ".env");
    if (!fs.existsSync(file)) return;
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const k = trimmed.slice(0, eq).trim();
      const v = trimmed.slice(eq + 1).trim();
      if (k && process.env[k] === undefined) process.env[k] = v;
    }
  } catch (e) {
    console.error("Could not read .env:", e.message);
  }
})();
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { WebSocketServer } = require("ws");
const db = require("./db");
const { translate } = require("./translate");

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const ROOM = "lobby";

const app = express();
app.use(express.json());

// --- serve the built frontend (so one `npm start` runs the whole app) ---
app.use(express.static(path.join(__dirname, "public")));

// --- auth helpers ---
function tokenFor(user) {
  return jwt.sign(
    { id: user.id, name: user.name, lang: user.lang },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}
function userFromToken(token) {
  try { return jwt.verify(token, JWT_SECRET); } catch { return null; }
}

// --- REST API ---

// Dynamic aspect: account creation, handled by our backend (not a hosted service)
app.post("/api/signup", async (req, res) => {
  const { email, password, name, lang } = req.body || {};
  if (!email || !password || !name || !lang)
    return res.status(400).json({ error: "email, password, name and lang are required." });
  if (db.findUserByEmail(email))
    return res.status(409).json({ error: "That email is already registered." });
  const user = {
    id: crypto.randomUUID(),
    email: email.trim().toLowerCase(),
    password: bcrypt.hashSync(password, 10),
    name: name.trim(),
    lang,
    created_at: Date.now(),
  };
  db.createUser(user);
  res.json({ token: tokenFor(user), user: { id: user.id, name: user.name, lang: user.lang } });
});

app.post("/api/login", (req, res) => {
  const { email, password } = req.body || {};
  const row = db.findUserByEmail((email || "").trim().toLowerCase());
  if (!row || !bcrypt.compareSync(password || "", row.password))
    return res.status(401).json({ error: "Wrong email or password." });
  res.json({ token: tokenFor(row), user: { id: row.id, name: row.name, lang: row.lang } });
});

// Dynamic aspect: message history, served by our backend
app.get("/api/messages", (req, res) => {
  if (!userFromToken((req.headers.authorization || "").replace("Bearer ", "")))
    return res.status(401).json({ error: "Not authenticated." });
  res.json({ messages: db.recentMessages(ROOM) });
});

// On-demand translation endpoint (used by the client for incoming messages)
app.post("/api/translate", async (req, res) => {
  const { text, sourceLang, targetLang } = req.body || {};
  try {
    const translation = await translate(text, sourceLang, targetLang);
    res.json({ translation });
  } catch (e) {
    res.status(502).json({ error: "Translation failed." });
  }
});

// SPA fallback: anything not matched above returns the app shell.
// Using middleware (not a wildcard path) avoids Express 5 route-parsing issues.
app.use((req, res) => {
  if (req.method !== "GET") return res.status(404).json({ error: "Not found." });
  res.sendFile(path.join(__dirname, "public", "index.html"), (err) => {
    if (err) res.status(404).json({ error: "Not found." });
  });
});

// --- realtime: WebSocket server our own code owns ---
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

function broadcast(obj) {
  const payload = JSON.stringify(obj);
  wss.clients.forEach((c) => { if (c.readyState === 1) c.send(payload); });
}

wss.on("connection", (socket, req) => {
  // authenticate the socket from the token in the query string
  const url = new URL(req.url, "http://localhost");
  const me = userFromToken(url.searchParams.get("token") || "");
  if (!me) { socket.close(4001, "unauthenticated"); return; }

  socket.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (msg.type === "send") {
      const text = (msg.text || "").trim();
      if (!text) return;
      const row = {
        id: crypto.randomUUID(),
        room: ROOM,
        sender_id: me.id,
        sender_name: me.name,
        source_lang: me.lang,
        text,
        created_at: Date.now(),
      };
      db.insertMessage(row);                 // store via our backend
      broadcast({ type: "message", message: row }); // push live to everyone
    }
  });
});

server.listen(PORT, () => console.log("CommonTongue backend on :" + PORT));
module.exports = { app, server };
