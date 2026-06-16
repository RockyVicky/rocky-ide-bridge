const axios = require('axios');
const key = 'AIzaSyAi7g1f-n6uT0P8UJlLO9vz4xsgd4TwSaA';
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
