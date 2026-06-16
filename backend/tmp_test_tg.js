require('dotenv').config();
const axios = require('axios');

async function checkTelegram() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log("No TELEGRAM_BOT_TOKEN found.");
    return;
  }
  console.log("Token exists. Testing connectivity to api.telegram.org...");
  try {
    const res = await axios.get(`https://api.telegram.org/bot${token}/getMe`, { timeout: 10000 });
    console.log("Success! Bot info:", res.data.result.username);
  } catch (err) {
    console.error("Error connecting to Telegram:", err.message);
  }
}

checkTelegram();
