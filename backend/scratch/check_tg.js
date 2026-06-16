require('dotenv').config();
const { Telegraf } = require('telegraf');

const token = process.env.TELEGRAM_BOT_TOKEN;
const userId = process.env.TELEGRAM_USER_ID;

console.log('Token:', token ? `${token.substring(0, 10)}...` : 'undefined');
console.log('User ID:', userId);

if (!token) {
  console.error('No token found');
  process.exit(1);
}

const bot = new Telegraf(token);

bot.telegram.getMe().then(me => {
  console.log('Bot Info:', me);
  console.log('Attempting to send a test message to user ID:', userId);
  return bot.telegram.sendMessage(userId, 'Hello! This is a test message from check_tg.js.');
}).then(() => {
  console.log('Test message sent successfully!');
  process.exit(0);
}).catch(err => {
  console.error('Error occurred:', err);
  process.exit(1);
});
