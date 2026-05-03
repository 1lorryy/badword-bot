const { handleChannelToolsCommand } = require("./commands/channelTools");
const { handleAfkCommand, handleAfkMentionsAndReturn } = require("./commands/afk");
const { handleAuctionCommand } = require("./commands/auction");

const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  EmbedBuilder,
} = require("discord.js");

const DEFAULT_PREFIX = "?";

const STAFF_ROLE_ID = "1481370041420087474";
const MOD_ROLE_ID = "1481370041432932379";
const MAIN_ADMIN_ROLE_ID = "1481370041441189959";

let client;

// ===== MEMORY STORAGE (simple but working) =====
if (!global.warns) global.warns = {};
if (!global.blacklist) global.blacklist = [];

// ================= MEMBER FIND =================
async function findTargetMember(message, args) {
  const mention = message.mentions.members.first();
  if (mention) return mention;

  if (message.reference) {
    const replied = await message.fetchReference().catch(() => null);
    if (replied?.author) {
      return await message.guild.members.fetch(replied.author.id).catch(() => null);
    }
  }

  const input = args[0];
  if (!input) return null;

  const byId = await message.guild.members.fetch(input).catch(() => null);
  if (byId) return byId;

  const search = input.toLowerCase();

  return message.guild.members.cache.find(m =>
    m.user.username.toLowerCase() === search ||
    m.displayName.toLowerCase() === search ||
    m.user.tag.toLowerCase() === search
  ) || null;
}

// ================= PERMISSIONS =================
function canManageGuild(message) {
  const roles = message.member.roles.cache;
  return (
    message.member.permissions.has(PermissionsBitField.Flags.Administrator) ||
    roles.has(MAIN_ADMIN_ROLE_ID) ||
    roles.has(STAFF_ROLE_ID) ||
    roles.has(MOD_ROLE_ID)
  );
}

// ================= COMMANDS =================
async function handleCommands(message) {
  const prefix = DEFAULT_PREFIX;
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/\s+/);
  const command = args.shift().toLowerCase();

  // ===== AFK =====
  if (command === "afk") return handleAfkCommand(message, args, prefix);

  // ===== AUCTION =====
  if (command === "auction") return handleAuctionCommand(message, args, prefix);
  if (command === "bid") return handleAuctionCommand(message, ["bid", ...args], prefix);

  // ===== CHANNEL TOOLS =====
  if (["slowmode", "lock", "unlock"].includes(command)) {
    return handleChannelToolsCommand(message, args, prefix, command, canManageGuild);
  }

  // ================= WARN =================
  if (command === "warn") {
    if (!canManageGuild(message)) return;

    const member = await findTargetMember(message, args);
    if (!member) return message.reply("User not found");

    const reason = message.reference
      ? args.join(" ")
      : args.slice(1).join(" ") || "No reason";

    const warnId = Date.now().toString();

    if (!global.warns[member.id]) global.warns[member.id] = [];

    global.warns[member.id].push({
      id: warnId,
      reason,
      mod: message.author.id
    });

    return message.reply(`⚠️ Warned ${member.user.tag}\n🆔 ID: \`${warnId}\``);
  }

  // ===== WARNINGS LIST =====
  if (command === "warnings") {
    const member = await findTargetMember(message, args) || message.member;

    const warns = global.warns[member.id] || [];
    if (!warns.length) return message.reply("No warnings");

    const text = warns.map(w => `ID: \`${w.id}\`\nReason: ${w.reason}`).join("\n\n");

    return message.reply({
      embeds: [new EmbedBuilder().setColor(0xf59e0b).setDescription(text)]
    });
  }

  // ===== UNWARN =====
  if (command === "unwarn") {
    if (!canManageGuild(message)) return;

    const member = await findTargetMember(message, args);
    const warnId = args[1];

    if (!member || !warnId) return message.reply("Usage: ?unwarn @user ID");

    if (!global.warns[member.id]) return message.reply("No warns");

    const before = global.warns[member.id].length;
    global.warns[member.id] =
      global.warns[member.id].filter(w => w.id !== warnId);

    if (before === global.warns[member.id].length) {
      return message.reply("ID not found");
    }

    return message.reply("✅ Warn removed");
  }

  // ================= MUTE =================
  if (command === "mute") {
    if (!canManageGuild(message)) return;

    const member = await findTargetMember(message, args);
    if (!member) return message.reply("User not found");

    const duration = message.reference ? args[0] : args[1];
    if (!duration) return message.reply("Provide time (10s, 1m)");

    let ms = 60000;
    if (duration.endsWith("s")) ms = parseInt(duration) * 1000;
    if (duration.endsWith("m")) ms = parseInt(duration) * 60000;
    if (duration.endsWith("h")) ms = parseInt(duration) * 3600000;

    await member.timeout(ms);

    return message.reply(`🔇 Muted ${member.user.tag} for ${duration}`);
  }

  // ===== UNMUTE =====
  if (command === "unmute") {
    if (!canManageGuild(message)) return;

    const member = await findTargetMember(message, args);
    if (!member) return message.reply("User not found");

    await member.timeout(null);
    return message.reply(`🔊 Unmuted ${member.user.tag}`);
  }

  // ================= BAN =================
  if (command === "ban") {
    if (!canManageGuild(message)) return;

    const member = await findTargetMember(message, args);
    if (!member) return message.reply("User not found");

    await member.ban();
    return message.reply(`🔨 Banned ${member.user.tag}`);
  }

  // ===== UNBAN =====
  if (command === "unban") {
    if (!canManageGuild(message)) return;

    const id = args[0];
    if (!id) return message.reply("Provide ID");

    await message.guild.members.unban(id);
    return message.reply(`✅ Unbanned ${id}`);
  }

  // ================= BLACKLIST =================
  if (command === "bl") {
    const word = args[0]?.toLowerCase();
    if (!word) return message.reply("Provide word");

    if (global.blacklist.includes(word)) {
      return message.reply("Already blacklisted");
    }

    global.blacklist.push(word);
    return message.reply(`🚫 Added: ${word}`);
  }

  if (command === "unbl") {
    const word = args[0]?.toLowerCase();
    if (!word) return message.reply("Provide word");

    global.blacklist = global.blacklist.filter(w => w !== word);
    return message.reply(`✅ Removed: ${word}`);
  }

  if (command === "words") {
    if (!global.blacklist.length) return message.reply("No words");

    return message.reply(global.blacklist.join(", "));
  }

const { handleChannelToolsCommand } = require("./commands/channelTools");
const { handleAfkCommand, handleAfkMentionsAndReturn } = require("./commands/afk");
const { handleAuctionCommand } = require("./commands/auction");

const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  EmbedBuilder,
} = require("discord.js");

const DEFAULT_PREFIX = "?";

const STAFF_ROLE_ID = "1481370041420087474";
const MOD_ROLE_ID = "1481370041432932379";
const MAIN_ADMIN_ROLE_ID = "1481370041441189959";

let client;

// ===== MEMORY STORAGE (simple but working) =====
if (!global.warns) global.warns = {};
if (!global.blacklist) global.blacklist = [];

// ================= MEMBER FIND =================
async function findTargetMember(message, args) {
  const mention = message.mentions.members.first();
  if (mention) return mention;

  if (message.reference) {
    const replied = await message.fetchReference().catch(() => null);
    if (replied?.author) {
      return await message.guild.members.fetch(replied.author.id).catch(() => null);
    }
  }

  const input = args[0];
  if (!input) return null;

  const byId = await message.guild.members.fetch(input).catch(() => null);
  if (byId) return byId;

  const search = input.toLowerCase();

  return message.guild.members.cache.find(m =>
    m.user.username.toLowerCase() === search ||
    m.displayName.toLowerCase() === search ||
    m.user.tag.toLowerCase() === search
  ) || null;
}

// ================= PERMISSIONS =================
function canManageGuild(message) {
  const roles = message.member.roles.cache;
  return (
    message.member.permissions.has(PermissionsBitField.Flags.Administrator) ||
    roles.has(MAIN_ADMIN_ROLE_ID) ||
    roles.has(STAFF_ROLE_ID) ||
    roles.has(MOD_ROLE_ID)
  );
}

// ================= COMMANDS =================
async function handleCommands(message) {
  const prefix = DEFAULT_PREFIX;
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/\s+/);
  const command = args.shift().toLowerCase();

  // ===== AFK =====
  if (command === "afk") return handleAfkCommand(message, args, prefix);

  // ===== AUCTION =====
  if (command === "auction") return handleAuctionCommand(message, args, prefix);
  if (command === "bid") return handleAuctionCommand(message, ["bid", ...args], prefix);

  // ===== CHANNEL TOOLS =====
  if (["slowmode", "lock", "unlock"].includes(command)) {
    return handleChannelToolsCommand(message, args, prefix, command, canManageGuild);
  }

  // ================= WARN =================
  if (command === "warn") {
    if (!canManageGuild(message)) return;

    const member = await findTargetMember(message, args);
    if (!member) return message.reply("User not found");

    const reason = message.reference
      ? args.join(" ")
      : args.slice(1).join(" ") || "No reason";

    const warnId = Date.now().toString();

    if (!global.warns[member.id]) global.warns[member.id] = [];

    global.warns[member.id].push({
      id: warnId,
      reason,
      mod: message.author.id
    });

    return message.reply(`⚠️ Warned ${member.user.tag}\n🆔 ID: \`${warnId}\``);
  }

  // ===== WARNINGS LIST =====
  if (command === "warnings") {
    const member = await findTargetMember(message, args) || message.member;

    const warns = global.warns[member.id] || [];
    if (!warns.length) return message.reply("No warnings");

    const text = warns.map(w => `ID: \`${w.id}\`\nReason: ${w.reason}`).join("\n\n");

    return message.reply({
      embeds: [new EmbedBuilder().setColor(0xf59e0b).setDescription(text)]
    });
  }

  // ===== UNWARN =====
  if (command === "unwarn") {
    if (!canManageGuild(message)) return;

    const member = await findTargetMember(message, args);
    const warnId = args[1];

    if (!member || !warnId) return message.reply("Usage: ?unwarn @user ID");

    if (!global.warns[member.id]) return message.reply("No warns");

    const before = global.warns[member.id].length;
    global.warns[member.id] =
      global.warns[member.id].filter(w => w.id !== warnId);

    if (before === global.warns[member.id].length) {
      return message.reply("ID not found");
    }

    return message.reply("✅ Warn removed");
  }

  // ================= MUTE =================
  if (command === "mute") {
    if (!canManageGuild(message)) return;

    const member = await findTargetMember(message, args);
    if (!member) return message.reply("User not found");

    const duration = message.reference ? args[0] : args[1];
    if (!duration) return message.reply("Provide time (10s, 1m)");

    let ms = 60000;
    if (duration.endsWith("s")) ms = parseInt(duration) * 1000;
    if (duration.endsWith("m")) ms = parseInt(duration) * 60000;
    if (duration.endsWith("h")) ms = parseInt(duration) * 3600000;

    await member.timeout(ms);

    return message.reply(`🔇 Muted ${member.user.tag} for ${duration}`);
  }

  // ===== UNMUTE =====
  if (command === "unmute") {
    if (!canManageGuild(message)) return;

    const member = await findTargetMember(message, args);
    if (!member) return message.reply("User not found");

    await member.timeout(null);
    return message.reply(`🔊 Unmuted ${member.user.tag}`);
  }

  // ================= BAN =================
  if (command === "ban") {
    if (!canManageGuild(message)) return;

    const member = await findTargetMember(message, args);
    if (!member) return message.reply("User not found");

    await member.ban();
    return message.reply(`🔨 Banned ${member.user.tag}`);
  }

  // ===== UNBAN =====
  if (command === "unban") {
    if (!canManageGuild(message)) return;

    const id = args[0];
    if (!id) return message.reply("Provide ID");

    await message.guild.members.unban(id);
    return message.reply(`✅ Unbanned ${id}`);
  }

  // ================= BLACKLIST =================
  if (command === "bl") {
    const word = args[0]?.toLowerCase();
    if (!word) return message.reply("Provide word");

    if (global.blacklist.includes(word)) {
      return message.reply("Already blacklisted");
    }

    global.blacklist.push(word);
    return message.reply(`🚫 Added: ${word}`);
  }

  if (command === "unbl") {
    const word = args[0]?.toLowerCase();
    if (!word) return message.reply("Provide word");

    global.blacklist = global.blacklist.filter(w => w !== word);
    return message.reply(`✅ Removed: ${word}`);
  }

  if (command === "words") {
    if (!global.blacklist.length) return message.reply("No words");

    return message.reply(global.blacklist.join(", "));
  }

  // ================= HELP =================
  if (command === "help") {
    const embed = new EmbedBuilder()
      .setTitle("🔥 Commands")
      .setColor(0x5865f2)
      .setDescription(`Prefix: \`${prefix}\``)
      .addFields(
        { name: "🛡️ Moderation", value: "`?warn` • `?mute` • `?ban`", inline: false },
        { name: "⚙️ Server", value: "`?setprefix` • `?role`", inline: false },
        { name: "🚫 AutoMod", value: "`?bl` • `?unbl` • `?words`", inline: false },
        { name: "🏆 Auction", value: "`?auction` • `?bid`", inline: false },
        { name: "🔒 Channels", value: "`?lock` • `?unlock` • `?slowmode`", inline: false },
        { name: "💤 Utility", value: "`?afk` • `?ping`", inline: false }
      );

    return message.reply({ embeds: [embed] });
  }

  // ================= PING =================
  if (command === "ping") {
    const msg = await message.reply("🏓 Pinging...");
    const latency = msg.createdTimestamp - message.createdTimestamp;
    const api = Math.round(client.ws.ping);

    return msg.edit(`🏓 Pong!\n📨 ${latency}ms\n🌐 ${api}ms`);
  }
}

// ================= BOT =================
function startBot() {
  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.MessageContent
    ]
  });

  client.once("ready", () => {
    console.log(`Logged in as ${client.user.tag}`);
  });

  client.on("messageCreate", async (message) => {
    if (message.author.bot) return;

    await handleAfkMentionsAndReturn(message, DEFAULT_PREFIX);
    await handleCommands(message);
  });

  client.login(process.env.DISCORD_TOKEN);
}

module.exports = { startBot };

  // ================= HELP =================
  if (command === "help") {
    const embed = new EmbedBuilder()
      .setTitle("🔥 Commands")
      .setColor(0x5865f2)
      .setDescription(`Prefix: \`${prefix}\``)
      .addFields(
        { name: "🛡️ Moderation", value: "`?warn` • `?mute` • `?ban`", inline: false },
        { name: "⚙️ Server", value: "`?setprefix` • `?role`", inline: false },
        { name: "🚫 AutoMod", value: "`?bl` • `?unbl` • `?words`", inline: false },
        { name: "🏆 Auction", value: "`?auction` • `?bid`", inline: false },
        { name: "🔒 Channels", value: "`?lock` • `?unlock` • `?slowmode`", inline: false },
        { name: "💤 Utility", value: "`?afk` • `?ping`", inline: false }
      );

    return message.reply({ embeds: [embed] });
  }

  // ================= PING =================
  if (command === "ping") {
    const msg = await message.reply("🏓 Pinging...");
    const latency = msg.createdTimestamp - message.createdTimestamp;
    const api = Math.round(client.ws.ping);

    return msg.edit(`🏓 Pong!\n📨 ${latency}ms\n🌐 ${api}ms`);
  }
}

// ================= BOT =================
function startBot() {
  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.MessageContent
    ]
  });

  client.once("ready", () => {
    console.log(`Logged in as ${client.user.tag}`);
  });

  client.on("messageCreate", async (message) => {
    if (message.author.bot) return;

    await handleAfkMentionsAndReturn(message, DEFAULT_PREFIX);
    await handleCommands(message);
  });

  client.login(process.env.DISCORD_TOKEN);
}

module.exports = { startBot };