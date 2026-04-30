let activeAuction = null;

function parseTime(input) {
  const match = String(input).toLowerCase().match(/^(\d+)(s|m|min|h)$/);
  if (!match) return null;

  const num = parseInt(match[1]);
  const unit = match[2];

  if (unit === "s") return num * 1000;
  if (unit === "m" || unit === "min") return num * 60000;
  if (unit === "h") return num * 3600000;

  return null;
}

async function handleAuctionCommand(message, args, prefix) {
  const sub = args.shift()?.toLowerCase();

  if (!sub) return false;

  // START AUCTION
  if (sub === "start") {
    if (activeAuction) {
      await message.reply("❌ Auction already running.");
      return true;
    }

    const full = args.join(" ");
    const parts = full.split("|").map(p => p.trim());

    if (parts.length < 3) {
      await message.reply(`Usage: ${prefix}auction start item | price | time`);
      return true;
    }

    const item = parts[0];
    const price = parseInt(parts[1]);
    const timeMs = parseTime(parts[2]);

    if (!item || isNaN(price) || !timeMs) {
      await message.reply("❌ Invalid format.");
      return true;
    }

    activeAuction = {
      item,
      highestBid: price,
      highestBidder: null,
      channel: message.channel,
      endTime: Date.now() + timeMs
    };

    await message.channel.send(`🏁 **Auction Started!**\nItem: **${item}**\nStarting: **${price}**\nTime: **${parts[2]}**`);

    setTimeout(async () => {
      if (!activeAuction) return;

      if (activeAuction.highestBidder) {
        await activeAuction.channel.send(
          `🏆 Auction ended!\nWinner: <@${activeAuction.highestBidder}>\nBid: **${activeAuction.highestBid}**`
        );
      } else {
        await activeAuction.channel.send("❌ Auction ended with no bids.");
      }

      activeAuction = null;
    }, timeMs);

    return true;
  }

  // BID
  if (sub === "bid") {
    if (!activeAuction) {
      await message.reply("❌ No active auction.");
      return true;
    }

    const amount = parseInt(args[0]);

    if (isNaN(amount)) {
      await message.reply(`Usage: ${prefix}bid amount`);
      return true;
    }

    if (amount <= activeAuction.highestBid) {
      await message.reply(`❌ Bid must be higher than ${activeAuction.highestBid}`);
      return true;
    }

    activeAuction.highestBid = amount;
    activeAuction.highestBidder = message.author.id;

    await message.channel.send(`💰 New highest bid: **${amount}** by <@${message.author.id}>`);
    return true;
  }

  // END
  if (sub === "end") {
    if (!activeAuction) {
      await message.reply("❌ No active auction.");
      return true;
    }

    if (activeAuction.highestBidder) {
      await message.channel.send(
        `🏆 Auction ended!\nWinner: <@${activeAuction.highestBidder}>\nBid: **${activeAuction.highestBid}**`
      );
    } else {
      await message.channel.send("❌ Auction ended with no bids.");
    }

    activeAuction = null;
    return true;
  }

  // CANCEL
  if (sub === "cancel") {
    if (!activeAuction) {
      await message.reply("❌ No active auction.");
      return true;
    }

    activeAuction = null;
    await message.channel.send("❌ Auction cancelled.");
    return true;
  }

  return false;
}

module.exports = { handleAuctionCommand };