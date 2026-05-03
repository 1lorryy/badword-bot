const { handleChannelToolsCommand } = require("./commands/channelTools");
const { handleAfkCommand, handleAfkMentionsAndReturn } = require("./commands/afk");
const { handleAuctionCommand } = require("./commands/auction");

const fs = require("fs");
const path = require("path");
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

// ================= MEMBER FINDER =================
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

// ================= COMMAND HANDLER =================
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

  // ===== WARN =====
  if (command === "warn") {
    if (!canManageGuild(message)) return message.reply("No permission");

    const member = await findTargetMember(message, args);
    if (!member) return message.reply("User not found");

    const reason = message.reference ? args.join(" ") : args.slice(1).join(" ");
    return message.reply(`⚠️ Warned ${member.user.tag} - ${reason || "No reason"}`);
  }

  // ===== MUTE =====
  if (command === "mute") {
    if (!canManageGuild(message)) return;

    const member = await findTargetMember(message, args);
    if (!member) return message.reply("User not found");

    const duration = message.reference ? args[0] : args[1];
    if (!duration) return message.reply("Provide time");

    await member.timeout(60000); // simple for now
    return message.reply(`🔇 Muted ${member.user.tag}`);
  }

  // ===== BAN =====
  if (command === "ban") {
    if (!canManageGuild(message)) return;

    const member = await findTargetMember(message, args);
    if (!member) return message.reply("User not found");

    await member.ban();
    return message.reply(`🔨 Banned ${member.user.tag}`);
  }

  // ===== HELP =====
  if (command === "help") {
    const embed = new EmbedBuilder()
      .setTitle("🔥 Commands")
      .setColor(0x5865f2)
      .addFields(
        {
          name: "🛡️ Moderation",
          value: `\`${prefix}warn\`\n\`${prefix}mute\`\n\`${prefix}ban\``
        },
        {
          name: "🏆 Auction",
          value: `\`${prefix}auction start\`\n\`${prefix}bid\``
        },
        {
          name: "🔒 Channels",
          value: `\`${prefix}lock\`\n\`${prefix}unlock\`\n\`${prefix}slowmode\``
        },
        {
          name: "💤 Utility",
          value: `\`${prefix}afk\`\n\`${prefix}ping\``
        }
      );

    return message.reply({ embeds: [embed] });
  }

  // ===== PING =====
  if (command === "ping") {
    return message.reply("🏓 Pong!");
  }
}

// ================= BOT START =================
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