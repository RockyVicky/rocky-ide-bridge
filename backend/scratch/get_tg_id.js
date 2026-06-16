const axios = require('axios');
require('dotenv').config();

const token = '8732804432:AAF7QjMl7LtItz6cEeIovBZNGbMKzeeqKT8';

async function getID() {
  try {
    const resp = await axios.get(`https://api.telegram.org/bot${token}/getUpdates`);
    const updates = resp.data.result;
    if (updates.length > 0) {
      const lastUpdate = updates[updates.length - 1];
      const from = lastUpdate.message?.from || lastUpdate.callback_query?.from;
      if (from) {
        console.log(`FOUND_ID: ${from.id} (${from.first_name})`);
      } else {
        console.log("No messages found in updates.");
      }
    } else {
      console.log("No updates found. Please message the bot first.");
    }
  } catch (err) {
    console.error("Error fetching updates:", err.message);
  }
}

getID();
