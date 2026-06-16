require('dotenv').config();
const { Telegraf } = require('telegraf');

const token = process.env.TELEGRAM_BOT_TOKEN;
const userId = process.env.TELEGRAM_USER_ID;

console.log('=== Rocky Telegram Diagnostics ===');
console.log('Token exists:', !!token);
if (token) {
  console.log('Token prefix:', token.split(':')[0]);
}
console.log('Target User ID:', userId);

if (!token) {
  console.error('❌ Error: TELEGRAM_BOT_TOKEN is missing from .env');
  process.exit(1);
}

const bot = new Telegraf(token);

console.log('Connecting to Telegram API...');
bot.telegram.getMe()
  .then(me => {
    console.log('✅ Connected successfully!');
    console.log('Bot Username:', `@${me.username}`);
    console.log('Bot Name:', me.first_name);
    console.log(`Sending test message to User ID ${userId}...`);
    return bot.telegram.sendMessage(userId, '🤖 Rocky Telegram Test: Connectivity is working!');
  })
  .then(() => {
    console.log('✅ Test message sent successfully!');
    console.log('If you did NOT receive this message on Telegram, the USER_ID is likely incorrect.');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Connection Failed!');
    console.error('Error details:', err.message || err);
    process.exit(1);
  });
