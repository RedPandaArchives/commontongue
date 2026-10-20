// Data layer for CommonTongue.
// A small pure-JavaScript store persisted to a JSON file — no native modules,
// so it installs and runs on any machine with Node (no compiler needed).
// The exported interface matches what the rest of the app expects.
const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "commontongue-data.json");

// shape: { users: [...], messages: [...], translations: { key: text } }
let data = { users: [], messages: [], translations: {} };

// load existing data on startup, if any
try {
  if (fs.existsSync(DATA_FILE)) {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    data = {
      users: parsed.users || [],
      messages: parsed.messages || [],
      translations: parsed.translations || {},
    };
  }
} catch (e) {
  console.error("Could not read data file, starting empty:", e.message);
}

function save() {
  // synchronous write keeps the file consistent after every change
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

module.exports = {
  createUser(u) {
    data.users.push({
      id: u.id, email: u.email, password: u.password,
      name: u.name, lang: u.lang, created_at: u.created_at,
    });
    save();
  },
  findUserByEmail(email) {
    return data.users.find((u) => u.email === email);
  },
  insertMessage(m) {
    data.messages.push({
      id: m.id, room: m.room, sender_id: m.sender_id, sender_name: m.sender_name,
      source_lang: m.source_lang, text: m.text, created_at: m.created_at,
    });
    save();
  },
  recentMessages(room, limit = 100) {
    return data.messages
      .filter((m) => m.room === room)
      .sort((a, b) => a.created_at - b.created_at)
      .slice(-limit);
  },
  getCachedTranslation(key) {
    return Object.prototype.hasOwnProperty.call(data.translations, key)
      ? data.translations[key]
      : null;
  },
  putCachedTranslation(key, text) {
    if (!Object.prototype.hasOwnProperty.call(data.translations, key)) {
      data.translations[key] = text;
      save();
    }
  },
};
