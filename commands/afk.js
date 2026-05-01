const { EmbedBuilder } = require("discord.js");

const afkUsers = new Map();

function formatDuration(ms) {
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);

  if (day > 0) return `${day}d ${hr % 24}h`;
  if (hr > 0) return `${hr}h ${min % 60}m`;
  if (min > 0) return `${min}m ${sec % 60}s`;
  return `${sec}s`;
}

async function handleAfkCommand(message, args, prefix) {
  const reason = args.join(" ").trim() || "AFK";

  afkUsers.set(message.author.id, {
    reason,
    since: Date.now(),
    pings: []
  });

  await message.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle("💤 AFK Set")
        .setColor(0x5865f2)
        .setDescription(`${message.author} is now AFK.`)
        .addFields({ name: "Reason", value: reason })
        .setTimestamp()
    ]
  });

  return true;
}

async function handleAfkMentionsAndReturn(message, prefix) {
  if (!message.guild || message.author.bot) return;

  const authorAfk = afkUsers.get(message.author.id);

  if (authorAfk && !message.content.startsWith(`${prefix}afk`)) {
    afkUsers.delete(message.author.id);

    const awayFor = formatDuration(Date.now() - authorAfk.since);

    const pingList = authorAfk.pings.length
      ? authorAfk.pings
          .slice(-5)
          .map((p, i) => `${i + 1}. ${p.authorTag} — [jump](${p.url})`)
          .join("\n")
      : "Nobody pinged you.";

    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("👋 Welcome Back")
          .setColor(0x22c55e)
          .setDescription(`${message.author}, I removed your AFK.`)
          .addFields(
            { name: "AFK Time", value: awayFor, inline: true },
            { name: "Reason", value: authorAfk.reason, inline: true },
            { name: "Pings While AFK", value: pingList }
          )
          .setTimestamp()
      ]
    }).catch(() => null);
  }

  for (const user of message.mentions.users.values()) {
    const data = afkUsers.get(user.id);
    if (!data) continue;

    const awayFor = formatDuration(Date.now() - data.since);

    data.pings.push({
      authorTag: message.author.tag,
      url: message.url,
      time: Date.now()
    });

    if (data.pings.length > 10) data.pings.shift();

    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("💤 User is AFK")
          .setColor(0xf59e0b)
          .setDescription(`${user} is AFK.`)
          .addFields(
            { name: "Reason", value: data.reason, inline: false },
            { name: "AFK For", value: awayFor, inline: true }
          )
          .setTimestamp()
      ]
    }).catch(() => null);
  }
}

module.exports = {
  handleAfkCommand,
  handleAfkMentionsAndReturn
};