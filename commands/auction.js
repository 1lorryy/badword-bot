const ADMIN_ROLE_ID = "1481370041441189959";
const MANAGER_ROLE_ID = "1499376933635489893";
const SELLER_ROLE_ID = "1499376701220585575";

function canUseAuctionStaff(message) {
  if (!message.member) return false;

  // Admin permission always allowed
  if (message.member.permissions.has("Administrator")) return true;

  const roles = message.member.roles.cache;

  return (
    roles.has(ADMIN_ROLE_ID) ||
    roles.has(MANAGER_ROLE_ID) ||
    roles.has(SELLER_ROLE_ID)
  );
}
const { EmbedBuilder } = require("discord.js");

let activeAuction = null;
let auctionTimer = null;

function parseTime(input) {
  const match = String(input).toLowerCase().match(/^(\d+)(s|m|min|h|d)$/);
  if (!match) return null;

  const num = parseInt(match[1]);
  const unit = match[2];

  if (unit === "s") return num * 1000;
  if (unit === "m" || unit === "min") return num * 60 * 1000;
  if (unit === "h") return num * 60 * 60 * 1000;
  if (unit === "d") return num * 24 * 60 * 60 * 1000;

  return null;
}

function auctionEmbed(title, color, auction) {
  return new EmbedBuilder()
    .setTitle(title)
    .setColor(color)
    .addFields(
      { name: "Item", value: auction.item, inline: false },
      { name: "Highest Bid", value: String(auction.highestBid), inline: true },
      {
        name: "Highest Bidder",
        value: auction.highestBidder ? `<@${auction.highestBidder}>` : "No bids yet",
        inline: true
      }
    )
    .setTimestamp();
}

async function finishAuction(cancelled = false) {
  if (!activeAuction) return;

  const auction = activeAuction;
  activeAuction = null;

  if (auctionTimer) {
    clearTimeout(auctionTimer);
    auctionTimer = null;
  }

  if (cancelled) {
    await auction.channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("❌ Auction Cancelled")
          .setColor(0xef4444)
          .setDescription(`Auction for **${auction.item}** was cancelled.`)
      ]
    });
    return;
  }

  if (!auction.highestBidder) {
    await auction.channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("⏰ Auction Ended")
          .setColor(0xef4444)
          .setDescription(`Auction for **${auction.item}** ended with no bids.`)
      ]
    });
    return;
  }

  await auction.channel.send({
    embeds: [
      new EmbedBuilder()
        .setTitle("🏆 Auction Ended")
        .setColor(0x22c55e)
        .addFields(
          { name: "Item", value: auction.item, inline: false },
          { name: "Winner", value: `<@${auction.highestBidder}>`, inline: true },
          { name: "Winning Bid", value: String(auction.highestBid), inline: true }
        )
        .setTimestamp()
    ]
  });
}

async function handleAuctionCommand(message, args, prefix, canManageGuild) {
  const sub = args.shift()?.toLowerCase();

  if (!sub) {
    await message.reply(`Usage: ${prefix}auction start item | price | time`);
    return true;
  }

  if (["start", "end", "cancel"].includes(sub)) {
  if (!canUseAuctionStaff(message)) {
      await message.reply("❌ You do not have permission.");
      return true;
    }
  }

  if (sub === "start") {
    if (activeAuction) {
      await message.reply("❌ An auction is already running.");
      return true;
    }

    const parts = args.join(" ").split("|").map(x => x.trim());

    if (parts.length < 3) {
      await message.reply(`Usage: ${prefix}auction start item | price | time`);
      return true;
    }

    const item = parts[0];
    const startPrice = parseInt(parts[1]);
    const timeMs = parseTime(parts[2]);

    if (!item || isNaN(startPrice) || !timeMs) {
      await message.reply(`Example: ${prefix}auction start Nitro | 100 | 10min`);
      return true;
    }

    activeAuction = {
      item,
      highestBid: startPrice,
      highestBidder: null,
      channel: message.channel,
      startedBy: message.author.id,
      endsAt: Date.now() + timeMs
    };

    await message.channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("🏁 Auction Started")
          .setColor(0x5865f2)
          .addFields(
            { name: "Item", value: item, inline: false },
            { name: "Starting Price", value: String(startPrice), inline: true },
            { name: "Time", value: parts[2], inline: true },
            { name: "Bid Command", value: `${prefix}bid amount`, inline: false }
          )
          .setTimestamp()
      ]
    });

    auctionTimer = setTimeout(() => finishAuction(false), timeMs);
    return true;
  }

  if (sub === "bid") {
    if (!activeAuction) {
      await message.reply("❌ No active auction.");
      return true;
    }

    if (message.channel.id !== activeAuction.channel.id) {
      await message.reply("❌ Bids must be placed in the auction channel.");
      return true;
    }

    const amount = parseInt(args[0]);

    if (isNaN(amount)) {
      await message.reply(`Usage: ${prefix}bid amount`);
      return true;
    }

    if (amount <= activeAuction.highestBid) {
      await message.reply(`❌ Bid must be higher than ${activeAuction.highestBid}.`);
      return true;
    }

    activeAuction.highestBid = amount;
    activeAuction.highestBidder = message.author.id;

    await message.channel.send({
      embeds: [auctionEmbed("💰 New Highest Bid", 0x22c55e, activeAuction)]
    });

    return true;
  }

  if (sub === "end") {
    if (!activeAuction) {
      await message.reply("❌ No active auction.");
      return true;
    }

    await finishAuction(false);
    return true;
  }

  if (sub === "cancel") {
    if (!activeAuction) {
      await message.reply("❌ No active auction.");
      return true;
    }

    await finishAuction(true);
    return true;
  }

  if (sub === "status") {
    if (!activeAuction) {
      await message.reply("❌ No active auction.");
      return true;
    }

    await message.channel.send({
      embeds: [auctionEmbed("📊 Auction Status", 0x5865f2, activeAuction)]
    });

    return true;
  }

  return false;
}

module.exports = { handleAuctionCommand };