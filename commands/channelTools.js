const { PermissionsBitField, EmbedBuilder } = require("discord.js");

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

async function handleChannelToolsCommand(message, args, prefix, command, canManageGuild) {
  if (!canManageGuild(message)) {
    await message.reply("❌ You do not have permission.");
    return true;
  }

  if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
    await message.reply("❌ I need Manage Channels permission.");
    return true;
  }

  if (command === "slowmode") {
    const channel = getTargetChannel(message, args);

    let timeArg = args[0];

    if (message.mentions.channels.first() || message.guild.channels.cache.get(args[0]?.replace(/[<#>]/g, ""))) {
      timeArg = args[1];
    }

    if (!timeArg) {
      await message.reply(`Usage: ${prefix}slowmode #channel 10s`);
      return true;
    }

    if (["off", "disable", "0", "none"].includes(timeArg.toLowerCase())) {
      await channel.setRateLimitPerUser(0, `Slowmode disabled by ${message.author.tag}`);

      await message.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("✅ Slowmode Disabled")
            .setColor(0x22c55e)
            .setDescription(`${channel} slowmode is now off.`)
            .setTimestamp()
        ]
      });

      return true;
    }

    const seconds = parseTime(timeArg);

    if (seconds === null || seconds < 0 || seconds > 21600) {
      await message.reply("❌ Use time like `5s`, `10min`, `1h`. Max is 6h.");
      return true;
    }

    await channel.setRateLimitPerUser(seconds, `Slowmode set by ${message.author.tag}`);

    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("🐢 Slowmode Updated")
          .setColor(0x5865f2)
          .addFields(
            { name: "Channel", value: `${channel}`, inline: true },
            { name: "Time", value: timeArg, inline: true }
          )
          .setTimestamp()
      ]
    });

    return true;
  }

  if (command === "lock") {
    const channel = getTargetChannel(message, args);

    let reasonArgs = args;

    if (message.mentions.channels.first() || message.guild.channels.cache.get(args[0]?.replace(/[<#>]/g, ""))) {
      reasonArgs = args.slice(1);
    }

    const reason = reasonArgs.join(" ") || "Channel locked by staff";

    await channel.permissionOverwrites.edit(message.guild.roles.everyone, {
      SendMessages: false
    }, { reason });

    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("🔒 Channel Locked")
          .setColor(0xef4444)
          .addFields(
            { name: "Channel", value: `${channel}`, inline: true },
            { name: "Reason", value: reason, inline: false }
          )
          .setTimestamp()
      ]
    });

    return true;
  }

  if (command === "unlock") {
    const channel = getTargetChannel(message, args);

    await channel.permissionOverwrites.edit(message.guild.roles.everyone, {
      SendMessages: null
    }, { reason: `Channel unlocked by ${message.author.tag}` });

    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("🔓 Channel Unlocked")
          .setColor(0x22c55e)
          .setDescription(`${channel} is now unlocked.`)
          .setTimestamp()
      ]
    });

    return true;
  }

  return false;
}

module.exports = { handleChannelToolsCommand };