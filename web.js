const express = require("express");
const fs = require("fs");
const path = require("path");
const {
  getGuildConfig,
  setGuildPrefix,
  addGuildWord,
  removeGuildWord,
  addGuildDomain,
  removeGuildDomain,
  setGuildLinkSettings,
  getClient,
} = require("./bot");

const app = express();
const PORT = Number(process.env.WEB_PORT || 3000);
const CREATOR_DISCORD_ID = process.env.CREATOR_DISCORD_ID || "419893791844204546";
const CSS_PATH = path.join(__dirname, "dashboard.css");

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get("/dashboard.css", (req, res) => {
  res.type("text/css").send(fs.readFileSync(CSS_PATH, "utf8"));
});

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

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
          <div class="brand">Badword Bot</div>
          <a class="nav ${tab === "words" ? "active" : ""}" href="${sidebarBase}/words">Blacklisted Words</a>
          <a class="nav ${tab === "links" ? "active" : ""}" href="${sidebarBase}/links">Blocked Links</a>
          <a class="nav ${tab === "prefix" ? "active" : ""}" href="${sidebarBase}/prefix">Prefix</a>
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

  const items = guilds.map((g) => {
    return `<a class="guild-link" href="/dashboard/${g.id}/words">${escapeHtml(g.name)}</a>`;
  }).join("");

  return `
    <div class="card">
      <h2>Select a server</h2>
      <div class="guild-list">
        ${items || "<div>No servers found.</div>"}
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

app.get("/dashboard/:guildId/words", (req, res) => {
  const { guildId } = req.params;
  const cfg = getGuildConfig(guildId);

  const words = (cfg.words || []).map((word) => `<span class="pill">${escapeHtml(word)}</span>`).join("");

  res.send(renderPage({
    guildId,
    tab: "words",
    title: "Blacklisted Words",
    content: `
      <div class="card">
        <h2>Current words</h2>
        <div class="pill-wrap">${words || "<div>No words yet.</div>"}</div>
      </div>

      <div class="card">
        <h3>Add word</h3>
        <form method="POST" action="/dashboard/${guildId}/words/add" class="row">
          <input type="text" name="word" placeholder="Enter word" required />
          <button type="submit">Add</button>
        </form>
      </div>

      <div class="card">
        <h3>Remove word</h3>
        <form method="POST" action="/dashboard/${guildId}/words/remove" class="row">
          <input type="text" name="word" placeholder="Enter word" required />
          <button type="submit">Remove</button>
        </form>
      </div>
    `
  }));
});

app.post("/dashboard/:guildId/words/add", (req, res) => {
  addGuildWord(req.params.guildId, req.body.word || "");
  res.redirect(`/dashboard/${req.params.guildId}/words`);
});

app.post("/dashboard/:guildId/words/remove", (req, res) => {
  removeGuildWord(req.params.guildId, req.body.word || "");
  res.redirect(`/dashboard/${req.params.guildId}/words`);
});

app.get("/dashboard/:guildId/links", (req, res) => {
  const { guildId } = req.params;
  const cfg = getGuildConfig(guildId);

  const domains = (cfg.blockedDomains || []).map((d) => `<span class="pill">${escapeHtml(d)}</span>`).join("");

  res.send(renderPage({
    guildId,
    tab: "links",
    title: "Blocked Links",
    content: `
      <div class="card">
        <h2>Blocked domains</h2>
        <div class="pill-wrap">${domains || "<div>No blocked domains.</div>"}</div>
      </div>

      <div class="card">
        <h3>Add domain</h3>
        <form method="POST" action="/dashboard/${guildId}/links/add" class="row">
          <input type="text" name="domain" placeholder="example.com" required />
          <button type="submit">Add</button>
        </form>
      </div>

      <div class="card">
        <h3>Remove domain</h3>
        <form method="POST" action="/dashboard/${guildId}/links/remove" class="row">
          <input type="text" name="domain" placeholder="example.com" required />
          <button type="submit">Remove</button>
        </form>
      </div>

      <div class="card">
        <h3>Settings</h3>
        <form method="POST" action="/dashboard/${guildId}/links/settings">
          <label class="check">
            <input type="checkbox" name="blockDiscordInvites" ${cfg.blockDiscordInvites ? "checked" : ""} />
            Block Discord invites
          </label>
          <label class="check">
            <input type="checkbox" name="blockAllLinks" ${cfg.blockAllLinks ? "checked" : ""} />
            Block all links
          </label>
          <button type="submit">Save</button>
        </form>
      </div>
    `
  }));
});

app.post("/dashboard/:guildId/links/add", (req, res) => {
  addGuildDomain(req.params.guildId, req.body.domain || "");
  res.redirect(`/dashboard/${req.params.guildId}/links`);
});

app.post("/dashboard/:guildId/links/remove", (req, res) => {
  removeGuildDomain(req.params.guildId, req.body.domain || "");
  res.redirect(`/dashboard/${req.params.guildId}/links`);
});

app.post("/dashboard/:guildId/links/settings", (req, res) => {
  setGuildLinkSettings(req.params.guildId, {
    blockDiscordInvites: !!req.body.blockDiscordInvites,
    blockAllLinks: !!req.body.blockAllLinks,
  });
  res.redirect(`/dashboard/${req.params.guildId}/links`);
});

app.get("/dashboard/:guildId/prefix", (req, res) => {
  const { guildId } = req.params;
  const cfg = getGuildConfig(guildId);

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
          <input type="text" name="prefix" maxlength="3" placeholder="!" required />
          <button type="submit">Update</button>
        </form>
      </div>
    `
  }));
});

app.post("/dashboard/:guildId/prefix", (req, res) => {
  const prefix = String(req.body.prefix || "").trim();
  if (prefix && prefix.length <= 3) {
    setGuildPrefix(req.params.guildId, prefix);
  }
  res.redirect(`/dashboard/${req.params.guildId}/prefix`);
});

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
        <h2>Bot Info</h2>
        <p><b>Made by:</b> ${escapeHtml(CREATOR_DISCORD_ID)}</p>
        <p><b>Server:</b> ${escapeHtml(guild?.name || guildId)}</p>
        <p><b>Server ID:</b> ${escapeHtml(guildId)}</p>
        <p><b>Members:</b> ${guild?.memberCount ?? "Unknown"}</p>
      </div>
    `
  }));
});

function startWeb() {
  app.listen(PORT, () => {
    console.log(`Dashboard running at http://localhost:${PORT}`);
  });
}

module.exports = { startWeb };