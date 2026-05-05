require("dotenv").config();

const { startBot } = require("./bot");

startBot();

if (process.env.ENABLE_WEB === "true") {
  try {
    const { startWeb } = require("./web");
    startWeb();
  } catch (error) {
    console.error("Web dashboard failed to start:", error);
  }
}