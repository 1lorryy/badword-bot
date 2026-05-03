const { EmbedBuilder, PermissionsBitField } = require("discord.js");

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
  const member = message.member;

  const oldNickname = member.nickname;
  const displayName = member.nickname || member.user.username;

  afkUsers.set(message.author.id, {
    reason,
    since: Date.now(),
    pings: [],
    oldNickname
  });

  if (
    message.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageNicknames) &&
    member.manageable
  ) {
    const cleanName = displayName.replace(/^\[AFK\]\s*/i, "");
    const newNick = `[AFK] ${cleanName}`.slice(0, 32);
    await member.setNickname(newNick, "User went AFK").catch(() => null);
  }

  await message.reply({
    content: `${message.member.displayName} is now AFK - ${reason}`,
    allowedMentions: { parse: [] }
  }).catch(() => null);

  return true;
}

async function handleAfkMentionsAndReturn(message, prefix) {
  if (!message.guild || message.author.bot) return;

  const authorAfk = afkUsers.get(message.author.id);

  if (authorAfk && !message.content.startsWith(`${prefix}afk`)) {
    afkUsers.delete(message.author.id);

    const awayFor = formatDuration(Date.now() - authorAfk.since);

    if (
      message.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageNicknames) &&
      message.member.manageable
    ) {
      await message.member.setNickname(authorAfk.oldNickname, "User returned from AFK").catch(() => null);
    }

    const pingList = authorAfk.pings.length
      ? authorAfk.pings
          .slice(-5)
          .map((p, i) => `${i + 1}. ${p.authorTag} — [jump](${p.url})`)
          .join("\n")
      : "NOBODY PINGED U - CRY ABOUT IT";

    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("👋 Welcome Back")
          .setColor(0x22c55e)
          .setDescription(`${message.member.displayName}, I removed your AFK.`)
          .addFields(
            { name: "AFK Time", value: awayFor, inline: true },
            { name: "Reason", value: authorAfk.reason, inline: true },
            { name: "Pings While AFK", value: pingList, inline: false }
          )
          .setTimestamp()
      ],
      allowedMentions: { parse: [] }
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

    const member = message.guild.members.cache.get(user.id);
    const displayName = member ? member.displayName : user.username;

    await message.reply({
      content: `${displayName} is AFK for ${awayFor} - ${data.reason}`,
      allowedMentions: { parse: [] }
    }).catch(() => null);
  }
}

module.exports = {
  handleAfkCommand,
  handleAfkMentionsAndReturn
};s