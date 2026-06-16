require('dotenv').config();
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first'); // Force IPv4 first to prevent Windows fetch DNS hang

const { Telegraf } = require('telegraf');

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("Token missing");
  process.exit(1);
}

const bot = new Telegraf(token);

console.log("Calling bot.launch() with dns ipv4first enabled...");
bot.launch().then(() => {
  console.log("✅ bot.launch() resolved successfully!");
  console.log("Bot is polling. Send a message to your bot now.");
  
  bot.on('text', (ctx) => {
    console.log("Received text message:", ctx.message.text);
    ctx.reply("Reply from test_launch.js!");
  });
}).catch(err => {
  console.error("❌ bot.launch() rejected:", err);
});

// Auto exit after 20 seconds
setTimeout(() => {
  console.log("Exiting test after 20s...");
  bot.stop();
  process.exit(0);
}, 20000);
