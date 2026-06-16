const ngrok = require('ngrok');
(async () => {
  try {
    const url = await ngrok.connect(3001);
    console.log('URL:', url);
    await ngrok.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
