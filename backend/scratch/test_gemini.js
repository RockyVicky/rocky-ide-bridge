const axios = require('axios');
const key = 'AIzaSyAi7g1f-n6uT0P8UJlLO9vz4xsgd4TwSaA';
const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;

async function test() {
  try {
    const res = await axios.post(url, {
      contents: [{ parts: [{ text: "Hello" }] }]
    });
    console.log("SUCCESS:", JSON.stringify(res.data));
  } catch (err) {
    console.log("FAILURE:", err.response?.status, JSON.stringify(err.response?.data));
  }
}

test();
