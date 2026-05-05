const { EmbedBuilder } = require("discord.js");

async function deleteAfter(msg, ms = 5000) {
  if (!msg) return;
  setTimeout(() => msg.delete().catch(() => null), ms);
}

async function handleBuyCommand(message, args, prefix, canManageGuild) {
  if (!canManageGuild(message)) {
    const msg = await message.reply("❌ Staff only command.");
    await deleteAfter(msg);
    return true;
  }

  // delete user command message
  await message.delete().catch(() => null);

  const embed = new EmbedBuilder()
    .setTitle("🛒 Purchase Links")
    .setColor(0x5865f2)
    .setDescription("Select the upgrade or add-on you want below.")

    // ===== CLASSES =====
    .addFields({
      name: "✈️ Classes",
      value: [
        "[Economy](https://www.roblox.com/game-pass/)",
        "[Premium Economy](https://www.roblox.com/game-pass/)",
        "[Business Class](https://www.roblox.com/game-pass/)",
        "[First Class](https://www.roblox.com/game-pass/)"
      ].join("\n"),
    })

    // ===== 10M-6H =====
    .addFields({
      name: "⏱️ 10M–6H Ads",
      value: [
        "[Drops Ping](https://www.roblox.com/game-pass/1809387047/Drops-Ping-6H)",
        "[Sponsor/Here Ping](https://www.roblox.com/game-pass/1809387042/Sponsor-Here-Ping-6H)",
        "[Everyone Ping](https://www.roblox.com/game-pass/1809201052/Everyone-Ping-6H)"
      ].join("\n"),
    })

    // ===== 6H-24H =====
    .addFields({
      name: "🕒 6H–24H Ads",
      value: [
        "[Drops Ping](https://www.roblox.com/game-pass/1808277089/Drops-Ping-24H)",
        "[Sponsor/Here Ping](https://www.roblox.com/game-pass/1808415066/Sponsor-Here-Ping-24H)",
        "[Everyone Ping](https://www.roblox.com/game-pass/1809369029/Everyone-Ping-24H)"
      ].join("\n"),
    })

    // ===== EXTRAS =====
    .addFields({
      name: "➕ Extras",
      value: [
        "[Custom Channel](https://www.roblox.com/game-pass/1808246271/Custom-Channel)",
        "[Extra Day](https://www.roblox.com/game-pass/1807563042/Extra-Day)",
        "[Skip Queue](https://www.roblox.com/game-pass/1809549057/Skip-Queue)",
        "[Ping on Join](https://www.roblox.com/game-pass/1807959069/Ping-On-Join)"
      ].join("\n"),
    })

    .setFooter({
      text: "💳 Purchase your ads & upgrades above"
    })
    .setTimestamp();

  const sent = await message.channel.send({ embeds: [embed] }).catch(() => null);

  return true;
}

module.exports = { handleBuyCommand };