# CommonTongue

A real-time team chat where **each person reads every message in their own language**.
You write in yours; everyone else reads it in theirs, translated automatically.

Built for the "Project Java and Web Development" portfolio (DLBCSPJWD01).

---

## What it does

- **Accounts** — sign up / log in with email + password (passwords are hashed, never stored in plain text).
- **Live chat** — messages appear instantly for everyone in the room, pushed over a WebSocket.
- **Automatic translation** — each incoming message is translated into the reader's chosen
  language. A shared cache means the same text is translated only once.

## Architecture

Everything runs on an **own backend** — no third-party backend service.

| Part        | Technology                        | Responsibility                                   |
|-------------|-----------------------------------|--------------------------------------------------|
| Frontend    | React (built with Vite)           | UI, talks to the backend over REST + WebSocket   |
| Backend     | Node.js + Express                 | REST API, authentication, message storage        |
| Realtime    | `ws` WebSocket server             | Pushes new messages to all connected clients live |
| Storage     | JSON file (pure JavaScript)       | Users, messages, translation cache — one local file |
| Translation | DeepL API, called server-side     | Key stays on the server, never reaches the browser |

**Two dynamic front-end ↔ back-end interactions:**
1. **Sending a message** — the client sends it over the WebSocket; the server stores it and
   broadcasts it live to every connected client.
2. **Receiving + translating** — the client calls the server's `/api/translate` endpoint and
   displays the message in the reader's own language.

## Requirements

- [Node.js](https://nodejs.org/) version 18 or newer (includes `npm`).
- A free DeepL API key — sign up at https://www.deepl.com/pro-api (the free tier is enough).

## Setup and running

**1. Install dependencies**

```
npm install
```

**2. Create a `.env` file**

Copy the example and fill in your DeepL key:

```
cp .env.example .env
```

Then edit `.env`:

```
DEEPL_API_KEY=your-real-deepl-key
JWT_SECRET=any-long-random-string
PORT=3001
```

**3. Start the app**

```
npm start
```

This builds the frontend and starts the server. Open **http://localhost:3001** in your browser.

To see the translation in action, open the app in **two browser windows** (or one normal and
one private/incognito window), sign up as two users with **different languages** (e.g. English
and German), and send a message from each — each side sees the other's messages in its own language.

## Running the tests

An automated end-to-end test boots the server in-process and checks signup, login, auth guards,
live WebSocket delivery, and message persistence:

```
npm test
```

Expected output ends with `10 passed, 0 failed`.

## Project structure

```
server.js        Express + WebSocket server (REST API, auth, realtime)
db.js            Data layer (users, messages, translation cache) in a JSON file
translate.js     Server-side DeepL translation with caching
selftest.js      Automated end-to-end tests
vite.config.js   Frontend build configuration
frontend/
  App.jsx        React UI (auth screen + chat room)
  api.js         Client for the backend (REST + WebSocket)
  main.jsx       React entry point
  index.html     Page shell
```

## Development mode (optional)

To run the frontend and backend separately with hot-reload:

```
npm run dev:server     # terminal 1 — backend on :3001
npm run dev:client     # terminal 2 — Vite dev server, proxies /api and /ws to the backend
```
