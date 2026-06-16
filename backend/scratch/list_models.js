const axios = require('axios');
require('dotenv').config();

const key = process.env.GEMINI_API_KEY;
if (!key) {
  console.error("Error: GEMINI_API_KEY is not defined in the environment or .env file.");
  process.exit(1);
}
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;

async function test() {
  try {
    const res = await axios.get(url);
    console.log("MODELS:", JSON.stringify(res.data.models.map(m => m.name)));
  } catch (err) {
    console.log("FAILURE:", err.response?.status, JSON.stringify(err.response?.data));
  }
}

test();
