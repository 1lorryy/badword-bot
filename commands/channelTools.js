const { PermissionsBitField, EmbedBuilder } = require("discord.js");

const DELETE_AFTER_MS = 5000;

function parseTime(input) {
  if (!input) return null;

  const match = String(input).toLowerCase().match(/^(\d+)(s|sec|m|min|h|hr)$/);
  if (!match) return null;

  const num = parseInt(match[1], 10);
  const unit = match[2];

  if (unit === "s" || unit === "sec") return num;
  if (unit === "m" || unit === "min") return num * 60;
  if (unit === "h" || unit === "hr") return num * 60 * 60;

  return null;
}

function getTargetChannel(message, args) {
  const mentioned = message.mentions.channels.first();
  if (mentioned) return mentioned;

  const possibleId = args[0]?.replace(/[<#>]/g, "");
  const byId = message.guild.channels.cache.get(possibleId);
  if (byId) return byId;

  return message.channel;
}

async function deleteLater(msg, ms = DELETE_AFTER_MS) {
  if (!msg) return;
  setTimeout(() => {
    msg.delete().catch(() => null);
  }, ms);
}

async function cleanCommandMessage(message) {
  await message.delete().catch(() => null);
}

async function sendSmallEmbed(message, color, text) {
  const sent = await message.channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor(color)
        .setDescription(text)
    ]
  }).catch(() => null);

  await deleteLater(sent);
}

async function handleChannelToolsCommand(message, args, prefix, command, canManageGuild) {
  await cleanCommandMessage(message);

  if (!canManageGuild(message)) {
    const reply = await message.channel.send("❌ You do not have permission.").catch(() => null);
    await deleteLater(reply);
    return true;
  }

  if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
    const reply = await message.channel.send("❌ I need Manage Channels permission.").catch(() => null);
    await deleteLater(reply);
    return true;
  }

  if (command === "slowmode") {
    const channel = getTargetChannel(message, args);

    let timeArg = args[0];

    if (
      message.mentions.channels.first() ||
      message.guild.channels.cache.get(args[0]?.replace(/[<#>]/g, ""))
    ) {
      timeArg = args[1];
    }

    if (!timeArg) {
      const reply = await message.channel.send(`Usage: ${prefix}slowmode #channel 10s`).catch(() => null);
      await deleteLater(reply);
      return true;
    }

    if (["off", "disable", "0", "none"].includes(timeArg.toLowerCase())) {
      await channel.setRateLimitPerUser(0, `Slowmode disabled by ${message.author.tag}`);
      await sendSmallEmbed(message, 0x22c55e, `✅ Slowmode: ${channel} → **off**`);
      return true;
    }

    const seconds = parseTime(timeArg);

    if (seconds === null || seconds < 0 || seconds > 21600) {
      const reply = await message.channel.send("❌ Use time like `5s`, `10min`, `1h`. Max is 6h.").catch(() => null);
      await deleteLater(reply);
      return true;
    }

    await channel.setRateLimitPerUser(seconds, `Slowmode set by ${message.author.tag}`);
    await sendSmallEmbed(message, 0x5865f2, `🐢 Slowmode: ${channel} → **${timeArg}**`);
    return true;
  }

  if (command === "lock") {
    const channel = getTargetChannel(message, args);

    await channel.permissionOverwrites.edit(
      message.guild.roles.everyone,
      { SendMessages: false },
      { reason: `Channel locked by ${message.author.tag}` }
    );

    await sendSmallEmbed(message, 0xef4444, `🔒 ${channel} locked`);
    return true;
  }

  if (command === "unlock") {
    const channel = getTargetChannel(message, args);

    await channel.permissionOverwrites.edit(
      message.guild.roles.everyone,
      { SendMessages: null },
      { reason: `Channel unlocked by ${message.author.tag}` }
    );

    await sendSmallEmbed(message, 0x22c55e, `🔓 ${channel} unlocked`);
    return true;
  }

  return false;
}

module.exports = { handleChannelToolsCommand };