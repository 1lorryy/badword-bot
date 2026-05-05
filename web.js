const express = require("express");
const fs = require("fs");
const path = require("path");
const { getClient } = require("./bot");

const app = express();
const PORT = Number(process.env.WEB_PORT || process.env.PORT || 3000);

const DATA_FILE = path.join(__dirname, "guild-data.json");
const CSS_PATH = path.join(__dirname, "dashboard", "dashboard.css");

const DEFAULT_PREFIX = "?";

const CORE_BLACKLIST = [
  "ass",
  "nigga",
  "nigger",
  "nga",
  "idiot",
  "retard",
  "faggot",
  "fagot",
  "porn",
  "sex",
  "pussy",
  "boobs",
  "penis",
  "dick",
  "fuck",
  "idgaf",
  "motherfuck",
  "motherfucker",
  "mf",
  "asshole",
  "cunt",
  "possay",
  "sexcam",
  "bubs"
];

const BLOCKED_LINKS = [
  "discord.gg/",
  "discord.com/invite/",
  "onlyfans.com",
  "pornhub.com",
  "xvideos.com",
  "xnxx.com",
  "xhamster.com",
  "redtube.com"
];

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

function loadData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function getGuildData(guildId) {
  const data = loadData();

  if (!data[guildId]) {
    data[guildId] = {
      prefix: DEFAULT_PREFIX,
      words: [],
      warnings: {}
    };
    saveData(data);
  }

  if (!Array.isArray(data[guildId].words)) data[guildId].words = [];
  if (!data[guildId].warnings || typeof data[guildId].warnings !== "object") {
    data[guildId].warnings = {};
  }
  if (!data[guildId].prefix) data[guildId].prefix = DEFAULT_PREFIX;

  return data[guildId];
}

function updateGuildData(guildId, updater) {
  const data = loadData();

  if (!data[guildId]) {
    data[guildId] = {
      prefix: DEFAULT_PREFIX,
      words: [],
      warnings: {}
    };
  }

  if (!Array.isArray(data[guildId].words)) data[guildId].words = [];
  if (!data[guildId].warnings || typeof data[guildId].warnings !== "object") {
    data[guildId].warnings = {};
  }
  if (!data[guildId].prefix) data[guildId].prefix = DEFAULT_PREFIX;

  updater(data[guildId]);
  saveData(data);
}

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

app.get("/dashboard.css", (req, res) => {
  if (!fs.existsSync(CSS_PATH)) {
    return res.type("text/css").send("");
  }

  res.type("text/css").send(fs.readFileSync(CSS_PATH, "utf8"));
});

function renderPage({ guildId, tab, title, content }) {
  const sidebarBase = guildId ? `/dashboard/${guildId}` : "#";

  return `
  <html>
    <head>
      <title>${escapeHtml(title)}</title>
      <link rel="stylesheet" href="/dashboard.css" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
    </head>
    <body>
      <div class="layout">
        <aside class="sidebar">
          <div class="brand">DASHBOARD Bot</div>
          <a class="nav ${tab === "words" ? "active" : ""}" href="${sidebarBase}/words">AutoMod Words</a>
          <a class="nav ${tab === "links" ? "active" : ""}" href="${sidebarBase}/links">Blocked Links</a>
          <a class="nav ${tab === "prefix" ? "active" : ""}" href="${sidebarBase}/prefix">Prefix</a>
          <a class="nav ${tab === "warnings" ? "active" : ""}" href="${sidebarBase}/warnings">Warnings</a>
          <a class="nav ${tab === "info" ? "active" : ""}" href="${sidebarBase}/info">Info</a>
        </aside>

        <main class="content">
          <div class="topbar">
            <div class="title">${escapeHtml(title)}</div>
          </div>
          ${content}
        </main>
      </div>
    </body>
  </html>
  `;
}

function renderGuildSelect() {
  const client = getClient();
  const guilds = client?.guilds?.cache?.map((g) => g) || [];

  const items = guilds
    .map((g) => {
      return `<a class="guild-link" href="/dashboard/${g.id}/words">${escapeHtml(g.name)}</a>`;
    })
    .join("");

  return `
    <div class="card">
      <h2>Select a server</h2>
      <div class="guild-list">
        ${items || "<div>No servers found. Bot may still be starting.</div>"}
      </div>
    </div>
  `;
}

app.get("/", (req, res) => {
  res.send(renderPage({
    guildId: null,
    tab: "",
    title: "Dashboard",
    content: renderGuildSelect()
  }));
});

// ================= WORDS =================
app.get("/dashboard/:guildId/words", (req, res) => {
  const { guildId } = req.params;
  const cfg = getGuildData(guildId);

  const protectedWords = CORE_BLACKLIST
    .map((word) => `<span class="pill protected">${escapeHtml(word)}</span>`)
    .join("");

  const customWords = cfg.words
    .map((word) => `<span class="pill">${escapeHtml(word)}</span>`)
    .join("");

  res.send(renderPage({
    guildId,
    tab: "words",
    title: "AutoMod Words",
    content: `
      <div class="card">
        <h2>Protected words</h2>
        <p>These words stay forever and cannot be removed.</p>
        <div class="pill-wrap">${protectedWords}</div>
      </div>

      <div class="card">
        <h2>Custom words</h2>
        <div class="pill-wrap">${customWords || "<div>No custom words yet.</div>"}</div>
      </div>

      <div class="card">
        <h3>Add word</h3>
        <form method="POST" action="/dashboard/${guildId}/words/add" class="row">
          <input type="text" name="word" placeholder="Enter word" required />
          <button type="submit">Add</button>
        </form>
      </div>

      <div class="card">
        <h3>Remove custom word</h3>
        <form method="POST" action="/dashboard/${guildId}/words/remove" class="row">
          <input type="text" name="word" placeholder="Enter word" required />
          <button type="submit">Remove</button>
        </form>
      </div>
    `
  }));
});

app.post("/dashboard/:guildId/words/add", (req, res) => {
  const word = String(req.body.word || "").trim().toLowerCase();

  if (word && !CORE_BLACKLIST.includes(word)) {
    updateGuildData(req.params.guildId, (cfg) => {
      if (!cfg.words.includes(word)) cfg.words.push(word);
    });
  }

  res.redirect(`/dashboard/${req.params.guildId}/words`);
});

app.post("/dashboard/:guildId/words/remove", (req, res) => {
  const word = String(req.body.word || "").trim().toLowerCase();

  if (!CORE_BLACKLIST.includes(word)) {
    updateGuildData(req.params.guildId, (cfg) => {
      cfg.words = cfg.words.filter((w) => w !== word);
    });
  }

  res.redirect(`/dashboard/${req.params.guildId}/words`);
});

// ================= LINKS =================
app.get("/dashboard/:guildId/links", (req, res) => {
  const { guildId } = req.params;

  const links = BLOCKED_LINKS
    .map((link) => `<span class="pill">${escapeHtml(link)}</span>`)
    .join("");

  res.send(renderPage({
    guildId,
    tab: "links",
    title: "Blocked Links",
    content: `
      <div class="card">
        <h2>Blocked links</h2>
        <p>These are protected inside <b>bot.js</b>.</p>
        <div class="pill-wrap">${links}</div>
      </div>
    `
  }));
});

// ================= PREFIX =================
app.get("/dashboard/:guildId/prefix", (req, res) => {
  const { guildId } = req.params;
  const cfg = getGuildData(guildId);

  res.send(renderPage({
    guildId,
    tab: "prefix",
    title: "Prefix",
    content: `
      <div class="card">
        <h2>Current prefix</h2>
        <div class="big-pill">${escapeHtml(cfg.prefix)}</div>
      </div>

      <div class="card">
        <h3>Change prefix</h3>
        <form method="POST" action="/dashboard/${guildId}/prefix" class="row">
          <input type="text" name="prefix" maxlength="3" placeholder="?" required />
          <button type="submit">Update</button>
        </form>
      </div>
    `
  }));
});

app.post("/dashboard/:guildId/prefix", (req, res) => {
  const prefix = String(req.body.prefix || "").trim();

  if (prefix && prefix.length <= 3) {
    updateGuildData(req.params.guildId, (cfg) => {
      cfg.prefix = prefix;
    });
  }

  res.redirect(`/dashboard/${req.params.guildId}/prefix`);
});

// ================= WARNINGS =================
app.get("/dashboard/:guildId/warnings", (req, res) => {
  const { guildId } = req.params;
  const cfg = getGuildData(guildId);

  const warningCards = Object.entries(cfg.warnings || {})
    .map(([userId, warnings]) => {
      const warns = Array.isArray(warnings) ? warnings : [];

      const list = warns
        .map((w) => `
          <div class="warn-box">
            <b>ID:</b> ${escapeHtml(w.id)}<br/>
            <b>Reason:</b> ${escapeHtml(w.reason || "No reason")}<br/>
            <b>Moderator:</b> ${escapeHtml(w.mod || "Unknown")}<br/>
            <b>Date:</b> ${escapeHtml(w.date || "Unknown")}
          </div>
        `)
        .join("");

      return `
        <div class="card">
          <h3>User ID: ${escapeHtml(userId)}</h3>
          ${list || "<div>No warnings.</div>"}
        </div>
      `;
    })
    .join("");

  res.send(renderPage({
    guildId,
    tab: "warnings",
    title: "Warnings",
    content: warningCards || `<div class="card"><h2>No warnings saved.</h2></div>`
  }));
});

// ================= INFO =================
app.get("/dashboard/:guildId/info", (req, res) => {
  const { guildId } = req.params;
  const client = getClient();
  const guild = client?.guilds?.cache?.get(guildId);

  res.send(renderPage({
    guildId,
    tab: "info",
    title: "Info",
    content: `
      <div class="card">
        <h2>Server Info</h2>
        <p><b>Server:</b> ${escapeHtml(guild?.name || guildId)}</p>
        <p><b>Server ID:</b> ${escapeHtml(guildId)}</p>
        <p><b>Members:</b> ${guild?.memberCount ?? "Unknown"}</p>
      </div>
    `
  }));
});

function startWeb() {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Dashboard running at http://localhost:${PORT}`);
  });
}

module.exports = { startWeb };