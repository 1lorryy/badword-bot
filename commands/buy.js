const { EmbedBuilder } = require("discord.js");

async function handleBuyCommand(message, args, prefix, canManageGuild) {
  if (!canManageGuild(message)) {
    return message.reply("❌ Only staff can use this command.");
  }

  await message.delete().catch(() => null);

  const embed = new EmbedBuilder()
    .setTitle("🛒 Purchase Links")
    .setColor(0x5865f2)
    .setDescription("Select the upgrade or add-on you want to purchase below.")
    .addFields(
      {
        name: "✈️ Classes (coming soon!)",
        value: [
          "[Economy](https://www.roblox.com/game-pass/)",
          "[Premium Economy](https://www.roblox.com/game-pass/)",
          "[Business Class](https://www.roblox.com/game-pass/)",
          "[First Class](https://www.roblox.com/game-pass/)"
        ].join(" • "),
        inline: false
      },
      {
        name: "⏱️ 10M–6H Ads",
        value: [
          "[Drops Ping](https://www.roblox.com/game-pass/1809387047/Drops-Ping-6H)",
          "[Sponsor/Here Ping](https://www.roblox.com/game-pass/1809387042/Sponsor-Here-Ping-6H)",
          "[Everyone Ping](https://www.roblox.com/game-pass/1809201052/Everyone-Ping-6H)"
        ].join(" • "),
        inline: false
      },
      {
        name: "🕒 6H–24H Ads",
        value: [
          "[Drops Ping](https://www.roblox.com/game-pass/1808277089/Drops-Ping-24H)",
          "[Sponsor/Here Ping](https://www.roblox.com/game-pass/1808415066/Sponsor-Here-Ping-24H)",
          "[Everyone Ping](https://www.roblox.com/game-pass/1809369029/Everyone-Ping-24H)"
        ].join(" • "),
        inline: false
      },
      {
        name: "➕ Extras",
        value: [
          "[Custom Channel](https://www.roblox.com/game-pass/1808246271/Custom-Channel)",
          "[Extra Day](https://www.roblox.com/game-pass/1807563042/Extra-Day)",
          "[Skip Queue](https://www.roblox.com/game-pass/1809549057/Skip-Queue)",
          "[Ping on Join](https://www.roblox.com/game-pass/1807959069/Ping-On-Join)"
        ].join(" • "),
        inline: false
      }
    )
    .setFooter({ text: "Purchase add-ons and upgrades using the links above." })
    .setTimestamp();

  await message.channel.send({ embeds: [embed] });
  return true;
}

module.exports = { handleBuyCommand };