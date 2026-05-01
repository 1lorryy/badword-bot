const { handleAuctionCommand } = require("./commands/auction");

const { handleModerationCommand } = require("./commands/moderation");

const fs = require("fs");
const path = require("path");
const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  EmbedBuilder,
} = require("discord.js");

const GUILD_DATA_FILE = path.join(__dirname, "guild-data.json");
const LEGACY_BLACKLIST_FILE = path.join(__dirname, "blacklist.json");

const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID || "";
const MOD_ACTION_CHANNEL_ID = "1492845794192134245";
const BYPASS_ROLE_ID = process.env.BYPASS_ROLE_ID || "";
const DEFAULT_PREFIX = process.env.DEFAULT_PREFIX || "?";
const ADMIN_ROLE_IDS = String(process.env.MOD_ROLE_IDS || "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

const DEFAULT_BLOCKED_DOMAINS = [
  "discord.gg",
  "discord.com/invite",
  "onlyfans.com",
  "pornhub.com",
  "xvideos.com",
  "xnxx.com",
  "xhamster.com",
  "redtube.com",
  "grabify",
  "bit.ly",
  "tinyurl.com"
];

let client = null;
let botStarted = false;

function loadLegacyWords() {
  try {
    const raw = fs.readFileSync(LEGACY_BLACKLIST_FILE, "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data.words)
      ? [...new Set(data.words.map((w) => String(w).trim().toLowerCase()).filter(Boolean))]
      : [];
  } catch {
    return [];
  }
}

function loadGuildStore() {
  try {
    const raw = fs.readFileSync(GUILD_DATA_FILE, "utf8");
    const data = JSON.parse(raw);
    return typeof data === "object" && data !== null ? data : {};
  } catch {
    return {};
  }
}

function saveGuildStore(store) {
  fs.writeFileSync(GUILD_DATA_FILE, JSON.stringify(store, null, 2), "utf8");
}

let guildStore = loadGuildStore();
const legacyWords = loadLegacyWords();

function defaultGuildConfig() {
  return {
    prefix: DEFAULT_PREFIX,
    words: [...legacyWords],
    blockedDomains: [...DEFAULT_BLOCKED_DOMAINS],
    blockDiscordInvites: true,
    blockAllLinks: false,
    warnings: {}
  };
}

function ensureGuildConfig(guildId) {
  if (!guildStore[guildId]) {
    guildStore[guildId] = defaultGuildConfig();
    saveGuildStore(guildStore);
  }

  const cfg = guildStore[guildId];

  if (!Array.isArray(cfg.words)) cfg.words = [...legacyWords];
  if (!Array.isArray(cfg.blockedDomains)) cfg.blockedDomains = [...DEFAULT_BLOCKED_DOMAINS];
  if (typeof cfg.prefix !== "string" || !cfg.prefix.trim()) cfg.prefix = DEFAULT_PREFIX;
  if (typeof cfg.blockDiscordInvites !== "boolean") cfg.blockDiscordInvites = true;
  if (typeof cfg.blockAllLinks !== "boolean") cfg.blockAllLinks = false;
  if (typeof cfg.warnings !== "object" || cfg.warnings === null) cfg.warnings = {};

  saveGuildStore(guildStore);
  return cfg;
}

function getGuildConfig(guildId) {
  return ensureGuildConfig(guildId);
}

function setGuildPrefix(guildId, prefix) {
  const cfg = ensureGuildConfig(guildId);
  cfg.prefix = String(prefix).trim();
  saveGuildStore(guildStore);
}

function addGuildWord(guildId, word) {
  const cfg = ensureGuildConfig(guildId);
  const clean = String(word).trim().toLowerCase();
  if (!clean || cfg.words.includes(clean)) return false;
  cfg.words.push(clean);
  saveGuildStore(guildStore);
  return true;
}

function removeGuildWord(guildId, word) {
  const cfg = ensureGuildConfig(guildId);
  const clean = String(word).trim().toLowerCase();
  const before = cfg.words.length;
  cfg.words = cfg.words.filter((w) => w !== clean);
  saveGuildStore(guildStore);
  return cfg.words.length !== before;
}

function addGuildDomain(guildId, domain) {
  const cfg = ensureGuildConfig(guildId);
  const clean = String(domain).trim().toLowerCase();
  if (!clean || cfg.blockedDomains.includes(clean)) return false;
  cfg.blockedDomains.push(clean);
  saveGuildStore(guildStore);
  return true;
}

function removeGuildDomain(guildId, domain) {
  const cfg = ensureGuildConfig(guildId);
  const clean = String(domain).trim().toLowerCase();
  const before = cfg.blockedDomains.length;
  cfg.blockedDomains = cfg.blockedDomains.filter((d) => d !== clean);
  saveGuildStore(guildStore);
  return cfg.blockedDomains.length !== before;
}

function setGuildLinkSettings(guildId, updates) {
  const cfg = ensureGuildConfig(guildId);
  if (typeof updates.blockDiscordInvites === "boolean") cfg.blockDiscordInvites = updates.blockDiscordInvites;
  if (typeof updates.blockAllLinks === "boolean") cfg.blockAllLinks = updates.blockAllLinks;
  saveGuildStore(guildStore);
}

function addWarning(guildId, userId, moderatorId, reason) {
  const cfg = ensureGuildConfig(guildId);
  if (!cfg.warnings[userId]) cfg.warnings[userId] = [];

  const warning = {
    id: Date.now().toString(),
    moderatorId,
    reason,
    date: new Date().toISOString()
  };

  cfg.warnings[userId].push(warning);
  saveGuildStore(guildStore);
  return warning;
}

function removeWarning(guildId, userId, warnId) {
  const cfg = ensureGuildConfig(guildId);
  if (!cfg.warnings[userId]) return false;

  const before = cfg.warnings[userId].length;

  if (warnId) {
    cfg.warnings[userId] = cfg.warnings[userId].filter((w) => w.id !== warnId);
  } else {
    cfg.warnings[userId].pop();
  }

  if (cfg.warnings[userId] && cfg.warnings[userId].length === 0) {
    delete cfg.warnings[userId];
  }

  saveGuildStore(guildStore);
  return before !== (cfg.warnings[userId]?.length || 0);
}

function getWarnings(guildId, userId) {
  const cfg = ensureGuildConfig(guildId);
  return cfg.warnings[userId] || [];
}

function replaceLeetspeak(text) {
  return String(text)
    .toLowerCase()
    .replace(/[@4]/g, "a")
    .replace(/[1!|]/g, "i")
    .replace(/3/g, "e")
    .replace(/0/g, "o")
    .replace(/[5$]/g, "s")
    .replace(/7/g, "t")
    .replace(/9/g, "g")
    .replace(/q/g, "g");
}

function normalizeWord(word) {
  return replaceLeetspeak(word).replace(/[^a-z]/g, "");
}

function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildWordBypassRegex(word) {
  const normalized = normalizeWord(word);
  if (!normalized) return null;

  const letters = normalized.split("").map(escapeRegex);
  const between = "[^a-z]*";
  const body = letters.join(between);

  return new RegExp(`(^|[^a-z])${body}([^a-z]|$)`, "i");
}

function containsBlacklistedWord(content, words) {
  const preparedContent = replaceLeetspeak(content);

  for (const word of words) {
    const regex = buildWordBypassRegex(word);
    if (!regex) continue;
    if (regex.test(preparedContent)) return word;
  }

  return null;
}

function extractUrls(text) {
  const regex = /(https?:\/\/[^\s]+|www\.[^\s]+|discord\.gg\/[^\s]+|discord\.com\/invite\/[^\s]+)/gi;
  return String(text).match(regex) || [];
}

function containsBlockedLink(content, cfg) {
  const urls = extractUrls(content);
  if (!urls.length) return null;

  for (const url of urls) {
    const lower = url.toLowerCase();

    if (
      cfg.blockDiscordInvites &&
      (lower.includes("discord.gg/") || lower.includes("discord.com/invite/"))
    ) {
      return { type: "discord_invite", value: url };
    }

    for (const domain of cfg.blockedDomains) {
      if (lower.includes(String(domain).toLowerCase())) {
        return { type: "blocked_domain", value: url };
      }
    }

    if (cfg.blockAllLinks) {
      return { type: "any_link", value: url };
    }
  }

  return null;
}

function parseDuration(input) {
  if (!input) return null;

  const match = String(input)
    .toLowerCase()
    .match(/^(\d+)(s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days)$/);

  if (!match) return null;

  const amount = Number.parseInt(match[1], 10);
  const unit = match[2];

  if (["s", "sec", "secs", "second", "seconds"].includes(unit)) return amount * 1000;
  if (["m", "min", "mins", "minute", "minutes"].includes(unit)) return amount * 60 * 1000;
  if (["h", "hr", "hrs", "hour", "hours"].includes(unit)) return amount * 60 * 60 * 1000;
  if (["d", "day", "days"].includes(unit)) return amount * 24 * 60 * 60 * 1000;

  return null;
}

function hasBypassRole(message) {
  return !!(BYPASS_ROLE_ID && message.member?.roles?.cache?.has(BYPASS_ROLE_ID));
}

const STAFF_ROLE_ID = "1481370041420087474";
const MOD_ROLE_ID = "1481370041432932379";
const MAIN_ADMIN_ROLE_ID = "1481370041441189959";

function canManageGuild(message) {
  if (!message.member) return false;

  const roles = message.member.roles.cache;

  return (
    message.member.permissions.has(PermissionsBitField.Flags.Administrator) ||
    roles.has(MAIN_ADMIN_ROLE_ID) ||
    roles.has(STAFF_ROLE_ID) ||
    roles.has(MOD_ROLE_ID)
  );
}

function getChannelMention(message) {
  const channelId = message.channel?.id;
  if (!channelId) return "Unknown";
  return `<#${channelId}>`;
}

async function sendLogEmbed(embed) {
  if (!LOG_CHANNEL_ID || !client) return;

  const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
  if (!logChannel || !logChannel.isTextBased()) return;

  await logChannel.send({ embeds: [embed] }).catch(() => null);
}

async function sendModActionEmbed(embed) {
  if (!MOD_ACTION_CHANNEL_ID || !client) return false;

  const channel = await client.channels.fetch(MOD_ACTION_CHANNEL_ID).catch(() => null);
  if (!channel || !channel.isTextBased()) return false;

  await channel.send({ embeds: [embed] }).catch(() => null);
  return true;
}

async function sendReply(message, content) {
  return await message.reply(content).catch(() => null);
}

async function sendEmbedReply(message, embed) {
  return await message.reply({ embeds: [embed] }).catch(() => null);
}

async function sendUserDM(user, embed) {
  return await user.send({ embeds: [embed] }).catch(() => null);
}

async function sendTempReply(message, content, ms = 5000) {
  const reply = await message.reply(content).catch(() => null);
  if (!reply) return null;

  setTimeout(() => {
    reply.delete().catch(() => null);
  }, ms);

  return reply;
}

function makeModEmbed(title, color, fields) {
  return new EmbedBuilder()
    .setTitle(title)
    .setColor(color)
    .addFields(fields)
    .setTimestamp();
}

function makeDMEmbed(title, color, serverName, reason) {
  return new EmbedBuilder()
    .setTitle(title)
    .setColor(color)
    .addFields(
      { name: "Server", value: serverName || "Unknown", inline: false },
      { name: "Reason", value: reason || "No reason provided", inline: false }
    )
    .setTimestamp();
}

async function handlePurgeCommand(message, args, prefix) {
  if (!canManageGuild(message)) {
    await sendTempReply(message, "You do not have permission.");
    return true;
  }

  if (!message.guild.members.me?.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
    await sendTempReply(message, "I need Manage Messages permission.");
    return true;
  }

  if (!args.length) {
    await sendTempReply(message, `Usage: ${prefix}purge 1 or ${prefix}purge @user 1`);
    return true;
  }

  const mention = message.mentions.users.first();
  const repliedUserId = message.reference
    ? (await message.fetchReference().catch(() => null))?.author?.id
    : null;

  let targetUserId = null;
  let amount = null;

  if (mention) {
    targetUserId = mention.id;
    amount = Number.parseInt(args[args.length - 1], 10);
  } else if (args[0]?.toLowerCase() === "user" && repliedUserId) {
    targetUserId = repliedUserId;
    amount = Number.parseInt(args[1], 10);
  } else {
    amount = Number.parseInt(args[0], 10);
  }

  if (!Number.isInteger(amount) || amount < 1 || amount > 100) {
    await sendTempReply(message, "Amount must be between 1 and 100.");
    return true;
  }

  if (!targetUserId) {
    const deleted = await message.channel.bulkDelete(amount, true).catch(() => null);
    if (!deleted) {
      await sendTempReply(message, "Could not purge messages. Messages older than 14 days cannot be bulk deleted.");
      return true;
    }

    await sendTempReply(message, `Purged ${deleted.size} messages.`);
    return true;
  }

  const fetched = await message.channel.messages.fetch({ limit: 100 }).catch(() => null);
  if (!fetched) {
    await sendTempReply(message, "Could not fetch messages.");
    return true;
  }

  const filtered = fetched
    .filter((msg) => !msg.pinned)
    .filter((msg) => msg.author.id === targetUserId)
    .first(amount);

  if (!filtered.length) {
    await sendTempReply(message, "No matching messages found.");
    return true;
  }

  const deleted = await message.channel.bulkDelete(filtered, true).catch(() => null);
  if (!deleted) {
    await sendTempReply(message, "Could not purge those messages. Some may be older than 14 days.");
    return true;
  }

  await sendTempReply(message, `Purged ${deleted.size} messages from that user.`);
  return true;
}

async function handlePrefixCommand(message, cfg) {
  const prefix = cfg.prefix;
  if (!message.content.startsWith(prefix)) return false;

  const args = message.content.slice(prefix.length).trim().split(/\s+/);
  const command = (args.shift() || "").toLowerCase();

if (command === "auction") {
  return await handleAuctionCommand(message, args, prefix);
}

if (command === "bid") {
  return await handleAuctionCommand(message, ["bid", ...args], prefix);
}

  if (!command) return true;

  if (command === "ping") {
    const sent = await message.reply("🏓 Pinging...").catch(() => null);
    if (!sent) return true;

    const latency = sent.createdTimestamp - message.createdTimestamp;
    const apiPing = Math.round(client.ws.ping);

    let emoji = "🟢";
    if (latency > 150) emoji = "🟡";
    if (latency > 300) emoji = "🔴";

    await sent.edit(`${emoji} Pong! \`${latency}ms\`\n🌐 API: \`${apiPing}ms\``).catch(() => null);
    return true;
  }

  if (command === "prefix") {
    await sendTempReply(message, `Current prefix: ${cfg.prefix}`);
    return true;
  }

  if (command === "setprefix") {
    if (!canManageGuild(message)) {
      await sendTempReply(message, "You do not have permission.");
      return true;
    }

    const newPrefix = String(args[0] || "").trim();
    if (!newPrefix || newPrefix.length > 3) {
      await sendTempReply(message, `Usage: ${prefix}setprefix <1-3 characters>`);
      return true;
    }

    setGuildPrefix(message.guild.id, newPrefix);
    await sendTempReply(message, `Prefix updated to: ${newPrefix}`);
    return true;
  }

  if (command === "setnick") {
    if (!canManageGuild(message)) {
      await sendTempReply(message, "You do not have permission.");
      return true;
    }

    if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageNicknames)) {
      await sendTempReply(message, "I need Manage Nicknames permission.");
      return true;
    }

    const member =
      message.mentions.members.first() ||
      await message.guild.members.fetch(args[0]).catch(() => null);

    if (!member) {
      await sendTempReply(message, `Usage: ${prefix}setnick @user new nickname`);
      return true;
    }

    const newNick = args.slice(1).join(" ").trim();

    if (!newNick) {
      await sendTempReply(message, `Usage: ${prefix}setnick @user new nickname`);
      return true;
    }

    if (!member.manageable) {
      await sendTempReply(message, "I cannot change this user's nickname. Their role may be higher than mine.");
      return true;
    }

    if (newNick.length > 32) {
      await sendTempReply(message, "Nickname must be 32 characters or less.");
      return true;
    }

    await member.setNickname(newNick, `Nickname changed by ${message.author.tag}`);
    await sendReply(message, `✅ Changed nickname for ${member.user.tag} to: ${newNick}`);
    return true;
  }

  if (command === "words") {
    const words = cfg.words.length ? cfg.words.join(", ") : "No blocked words.";
    await sendTempReply(message, words);
    return true;
  }

  if (command === "bl" || command === "blacklist") {
    if (!canManageGuild(message)) {
      await sendTempReply(message, "You do not have permission.");
      return true;
    }

    const word = args.join(" ").trim().toLowerCase();
    if (!word) {
      await sendTempReply(message, `Usage: ${prefix}bl <word>`);
      return true;
    }

    const added = addGuildWord(message.guild.id, word);
    await sendTempReply(message, added ? `Blacklisted: ${word}` : `Could not blacklist: ${word}`);
    return true;
  }

  if (command === "unbl" || command === "unblacklist") {
    if (!canManageGuild(message)) {
      await sendTempReply(message, "You do not have permission.");
      return true;
    }

    const word = args.join(" ").trim().toLowerCase();
    if (!word) {
      await sendTempReply(message, `Usage: ${prefix}unbl <word>`);
      return true;
    }

    const removed = removeGuildWord(message.guild.id, word);
    await sendTempReply(message, removed ? `Removed from blacklist: ${word}` : `Could not find: ${word}`);
    return true;
  }

  if (command === "purge") {
    return await handlePurgeCommand(message, args, prefix);
  }

  if (command === "warn") {
    if (!canManageGuild(message)) {
      await sendTempReply(message, "You do not have permission.");
      return true;
    }

    const member =
      message.mentions.members.first() ||
      await message.guild.members.fetch(args[0]).catch(() => null);

    if (!member) {
      await sendTempReply(message, `Usage: ${prefix}warn @user reason`);
      return true;
    }

    const reason = args.slice(1).join(" ") || "No reason provided";
    const warning = addWarning(message.guild.id, member.id, message.author.id, reason);
    const total = getWarnings(message.guild.id, member.id).length;

    const channelEmbed = makeModEmbed("⚠️ User Warned", 0xf59e0b, [
      { name: "User", value: `${member.user.tag}`, inline: true },
      { name: "Moderator", value: `${message.author.tag}`, inline: true },
      { name: "Reason", value: reason, inline: false },
      { name: "Warnings", value: String(total), inline: true },
      { name: "Warn ID", value: warning.id, inline: true }
    ]);

    const dmEmbed = makeDMEmbed("⚠️ You were warned", 0xf59e0b, message.guild.name, reason);

    await sendUserDM(member.user, dmEmbed);
await sendModActionEmbed(channelEmbed);
await sendTempReply(message, `✅ Warned ${member.user.tag}.`);
return true;
  }

  if (command === "unwarn") {
    if (!canManageGuild(message)) {
      await sendTempReply(message, "You do not have permission.");
      return true;
    }

    const member =
      message.mentions.members.first() ||
      await message.guild.members.fetch(args[0]).catch(() => null);

    if (!member) {
      await sendTempReply(message, `Usage: ${prefix}unwarn @user optionalWarnId`);
      return true;
    }

    const warnId = args[1] || null;
    const removed = removeWarning(message.guild.id, member.id, warnId);

    const embed = makeModEmbed(removed ? "✅ Warning Removed" : "❌ Warning Not Found", removed ? 0x22c55e : 0xef4444, [
      { name: "User", value: `${member.user.tag}`, inline: true },
      { name: "Moderator", value: `${message.author.tag}`, inline: true }
    ]);

    await sendEmbedReply(message, embed);
    return true;
  }

  if (command === "warnings") {
    const member =
      message.mentions.members.first() ||
      await message.guild.members.fetch(args[0] || message.author.id).catch(() => null);

    if (!member) {
      await sendTempReply(message, `Usage: ${prefix}warnings @user`);
      return true;
    }

    const warnings = getWarnings(message.guild.id, member.id);

    if (!warnings.length) {
      await sendReply(message, `${member.user.tag} has no warnings.`);
      return true;
    }

    const list = warnings
      .slice(-10)
      .map((w, i) => `${i + 1}. ID: ${w.id}\nReason: ${w.reason}`)
      .join("\n\n");

    const embed = makeModEmbed(`Warnings for ${member.user.tag}`, 0xf59e0b, [
      { name: "Warnings", value: list.slice(0, 1024), inline: false }
    ]);

    await sendEmbedReply(message, embed);
    return true;
  }

  if (command === "mute" || command === "timeout") {
    if (!canManageGuild(message)) {
      await sendTempReply(message, "You do not have permission.");
      return true;
    }

    if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
      await sendTempReply(message, "I need Moderate Members permission.");
      return true;
    }

    const member =
      message.mentions.members.first() ||
      await message.guild.members.fetch(args[0]).catch(() => null);

    if (!member) {
      await sendTempReply(message, `Usage: ${prefix}mute @user 30min reason`);
      return true;
    }

    const durationText = args[1];
    const durationMs = parseDuration(durationText);

    if (!durationMs) {
      await sendTempReply(message, `Use: ${prefix}mute @user 30s / 1min / 30min / 2h / 14d reason`);
      return true;
    }

    const maxMs = 14 * 24 * 60 * 60 * 1000;
    if (durationMs > maxMs) {
      await sendTempReply(message, "Max mute is 14 days.");
      return true;
    }

    const reason = args.slice(2).join(" ") || "No reason provided";

    await member.timeout(durationMs, reason);

    const embed = makeModEmbed("🔇 User Muted", 0x3b82f6, [
      { name: "User", value: `${member.user.tag}`, inline: true },
      { name: "Moderator", value: `${message.author.tag}`, inline: true },
      { name: "Duration", value: durationText, inline: true },
      { name: "Reason", value: reason, inline: false }
    ]);

    await sendEmbedReply(message, embed);
    return true;
  }

  if (command === "unmute") {
    if (!canManageGuild(message)) {
      await sendTempReply(message, "You do not have permission.");
      return true;
    }

    const member =
      message.mentions.members.first() ||
      await message.guild.members.fetch(args[0]).catch(() => null);

    if (!member) {
      await sendTempReply(message, `Usage: ${prefix}unmute @user`);
      return true;
    }

    await member.timeout(null, "Unmuted by moderator");

    const embed = makeModEmbed("🔊 User Unmuted", 0x22c55e, [
      { name: "User", value: `${member.user.tag}`, inline: true },
      { name: "Moderator", value: `${message.author.tag}`, inline: true }
    ]);

    await sendEmbedReply(message, embed);
    return true;
  }

  if (command === "ban") {
    if (!canManageGuild(message)) {
      await sendTempReply(message, "You do not have permission.");
      return true;
    }

    if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.BanMembers)) {
      await sendTempReply(message, "I need Ban Members permission.");
      return true;
    }

    const member =
      message.mentions.members.first() ||
      await message.guild.members.fetch(args[0]).catch(() => null);

    if (!member) {
      await sendTempReply(message, `Usage: ${prefix}ban @user reason`);
      return true;
    }

    const reason = args.slice(1).join(" ") || "No reason provided";

    const dmEmbed = makeDMEmbed("🔨 You were banned", 0xef4444, message.guild.name, reason);
    await sendUserDM(member.user, dmEmbed);

    await member.ban({ reason });

    const channelEmbed = makeModEmbed("🔨 User Banned", 0xef4444, [
      { name: "User", value: `${member.user.tag}`, inline: true },
      { name: "Moderator", value: `${message.author.tag}`, inline: true },
      { name: "Reason", value: reason, inline: false }
    ]);

    await sendModActionEmbed(channelEmbed);
await sendTempReply(message, `✅ Banned ${member.user.tag}.`);
return true;
  }

  if (command === "unban") {
    if (!canManageGuild(message)) {
      await sendTempReply(message, "You do not have permission.");
      return true;
    }

    if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.BanMembers)) {
      await sendTempReply(message, "I need Ban Members permission.");
      return true;
    }

    const userId = args[0];
    if (!userId) {
      await sendTempReply(message, `Usage: ${prefix}unban userId reason`);
      return true;
    }

    const reason = args.slice(1).join(" ") || "No reason provided";

    await message.guild.members.unban(userId, reason);

    const embed = makeModEmbed("✅ User Unbanned", 0x22c55e, [
      { name: "User ID", value: userId, inline: true },
      { name: "Moderator", value: `${message.author.tag}`, inline: true },
      { name: "Reason", value: reason, inline: false }
    ]);

    await sendEmbedReply(message, embed);
    return true;
  }

  if (command === "role") {
    if (!canManageGuild(message)) {
      await sendTempReply(message, "You do not have permission.");
      return true;
    }

    if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      await sendTempReply(message, "I need Manage Roles permission.");
      return true;
    }

    const member =
      message.mentions.members.first() ||
      await message.guild.members.fetch(args[0]).catch(() => null);

    if (!member) {
      await sendTempReply(message, `Usage: ${prefix}role @user role`);
      return true;
    }

    const roleInput = args.slice(1).join(" ").trim();

    if (!roleInput) {
      await sendTempReply(message, `Usage: ${prefix}role @user role`);
      return true;
    }

    const role =
      message.mentions.roles.first() ||
      message.guild.roles.cache.find(r => r.name.toLowerCase() === roleInput.toLowerCase()) ||
      message.guild.roles.cache.get(roleInput.replace(/[<@&>]/g, ""));

    if (!role) {
      await sendTempReply(message, "Role not found.");
      return true;
    }

    if (role.managed) {
      await sendTempReply(message, "I cannot manage this role.");
      return true;
    }

    if (role.position >= message.guild.members.me.roles.highest.position) {
      await sendTempReply(message, "That role is higher than or equal to my highest role.");
      return true;
    }

    if (role.position >= message.member.roles.highest.position && !message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      await sendTempReply(message, "You cannot manage a role higher than or equal to your highest role.");
      return true;
    }

    if (member.roles.cache.has(role.id)) {
      await member.roles.remove(role, `Role removed by ${message.author.tag}`);
      await sendReply(message, `✅ Removed **${role.name}** from ${member.user.tag}.`);
    } else {
      await member.roles.add(role, `Role added by ${message.author.tag}`);
      await sendReply(message, `✅ Added **${role.name}** to ${member.user.tag}.`);
    }

    return true;
  }

  if (command === "help") {
    await sendReply(
      message,
      [
        `Commands:`,
        `${prefix}ping`,
        `${prefix}prefix`,
        `${prefix}setprefix <new>`,
        `${prefix}setnick @user nickname`,
        `${prefix}words`,
        `${prefix}bl <word>`,
        `${prefix}unbl <word>`,
        `${prefix}purge 1`,
        `${prefix}purge @user 1`,
        `${prefix}warn @user reason`,
        `${prefix}unwarn @user`,
        `${prefix}warnings @user`,
        `${prefix}mute @user 1min reason`,
        `${prefix}unmute @user`,
        `${prefix}ban @user reason`,
        `${prefix}unban userId reason`,
        `${prefix}role @user role`,
        `${prefix}auction start item | price | time`,
        `${prefix}bid amount`,
        `${prefix}auction status`,
        `${prefix}auction end`,
        `${prefix}auction cancel`,
      ].join("\n")
    );
    return true;
  }

  return false;
}

function makeWordEmbed({ authorTag, authorId, guildName, channelMention, matchedWord, originalContent }) {
  return new EmbedBuilder()
    .setTitle("Blocked word deleted")
    .setColor(0x3b82f6)
    .addFields(
      { name: "User", value: `${authorTag} (${authorId})`, inline: false },
      { name: "Server", value: guildName || "Unknown", inline: true },
      { name: "Channel", value: channelMention || "Unknown", inline: true },
      { name: "Matched word", value: String(matchedWord || "Unknown").slice(0, 1024), inline: true },
      { name: "Message", value: String(originalContent || "No content").slice(0, 1024), inline: false }
    )
    .setTimestamp();
}

function makeLinkEmbed({ authorTag, authorId, guildName, channelMention, blockedLink, originalContent }) {
  return new EmbedBuilder()
    .setTitle("Blocked link deleted")
    .setColor(0x3b82f6)
    .addFields(
      { name: "User", value: `${authorTag} (${authorId})`, inline: false },
      { name: "Server", value: guildName || "Unknown", inline: true },
      { name: "Channel", value: channelMention || "Unknown", inline: true },
      { name: "Type", value: String(blockedLink?.type || "Unknown").slice(0, 1024), inline: true },
      { name: "Matched link", value: String(blockedLink?.value || "Unknown").slice(0, 1024), inline: false },
      { name: "Message", value: String(originalContent || "No content").slice(0, 1024), inline: false }
    )
    .setTimestamp();
}

function startBot() {
  if (botStarted) return;
  botStarted = true;

  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.MessageContent
    ]
  });

  client.once("clientReady", () => {
    console.log(`Logged in as ${client.user.tag}`);
  });

  client.on("guildCreate", (guild) => {
    ensureGuildConfig(guild.id);
    console.log(`Joined guild: ${guild.name} (${guild.id})`);
  });

  client.on("messageCreate", async (message) => {
    try {
      if (message.author.bot) return;
      if (!message.guild) return;
      if (!message.content) return;

      const me = message.guild.members.me;
      if (!me) return;

      const cfg = getGuildConfig(message.guild.id);

      const handledCommand = await handlePrefixCommand(message, cfg);
      if (handledCommand) return;

      if (!me.permissions.has(PermissionsBitField.Flags.ManageMessages)) return;
      if (hasBypassRole(message)) return;

      const originalContent = message.content;
      const authorTag = message.author.tag;
      const authorId = message.author.id;
      const channelMention = getChannelMention(message);
      const guildName = message.guild.name;

      const blockedLink = containsBlockedLink(originalContent, cfg);
      if (blockedLink) {
        await message.delete().catch(() => null);

        const embed = makeLinkEmbed({
          authorTag,
          authorId,
          guildName,
          channelMention,
          blockedLink,
          originalContent
        });

        await sendLogEmbed(embed);
        return;
      }

      const matchedWord = containsBlacklistedWord(originalContent, cfg.words);
      if (!matchedWord) return;

      await message.delete().catch(() => null);

      const embed = makeWordEmbed({
        authorTag,
        authorId,
        guildName,
        channelMention,
        matchedWord,
        originalContent
      });

      await sendLogEmbed(embed);
    } catch (error) {
      console.error("Moderation error:", error);
    }
  });

  client.login(process.env.DISCORD_TOKEN);
}

function getClient() {
  return client;
}

module.exports = {
  startBot,
  getClient,
  getGuildConfig,
  setGuildPrefix,
  addGuildWord,
  removeGuildWord,
  addGuildDomain,
  removeGuildDomain,
  setGuildLinkSettings
};