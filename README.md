#CommonTongue — translation chat with accounts

Sign up, join the room, write in your language and read everyone else's in it.
Messages travel between separate browsers in real time; translation happens on
receipt. The API key stays on the server.

## What's real now

- ✅ **Real accounts.** Email + password via Supabase Auth. Your name and reading
  language persist across sessions.
- ✅ **Multi-user.** Different browsers/devices message each other live.
- ✅ **Key-safe translation** through the backend proxy.
- ✅ **Tightened access.** Only logged-in users can read; you can only post as yourself.
- ✅ **Cached translations.** Each (source, target, text) is translated once and
  reused by every viewer and every repeat — no per-person re-translation.

## Still missing

- ❌ One shared room ("lobby") — no private/group rooms yet.
- ❌ Engine is Claude — swap to DeepL for cost/latency (ready in api/translate.js).

## Setup

### 1. Supabase
1. Create a free project at supabase.com.
2. SQL Editor -> paste supabase-setup.sql -> run.
3. **Authentication -> Providers -> Email:** for easy testing, turn OFF
   "Confirm email" so sign-up logs you in instantly. (Re-enable for production.)
4. Settings -> API: copy the Project URL and the anon public key.

### 2. Anthropic
5. Get a key at console.anthropic.com.

### 3. Env vars
6. Copy .env.example -> .env and fill all three:
   - VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY  (public, browser)
   - ANTHROPIC_API_KEY  (server-only, used by /api/translate)

### 4. Run / deploy
7. npm install
8. Local: npm i -g vercel  then  vercel dev  (serves app + /api together).
   To test: open localhost:3000 in two DIFFERENT browsers (or a normal + an
   incognito window), sign up as two users with different languages, chat across.
9. Deploy: vercel deploy, set all three env vars in the Vercel dashboard, redeploy.

## Testing tip

Two accounts need two separate browser sessions (auth cookie is per-session).
Normal window + incognito window is the quickest way to be "two people".

## Security note

.env is git-ignored. Never commit it. The anon key is public by design (guarded
by RLS); the Anthropic key never leaves the server.
