# Rocky Dev Bridge: Quick Startup & Telegram Guide 🚀

Follow this step-by-step checklist to launch the Rocky Ecosystem and establish a stable, error-free connection to your IDE and Telegram bot.

---

## Step 1: Launch your IDE with Remote Debugging
Rocky uses the Chrome DevTools Protocol (CDP) to inject prompts and read results. The IDE *must* be launched with remote debugging enabled on port `9015`.
1. Close any open IDE instances.
2. Open PowerShell/Command Prompt and run:
   ```powershell
   "C:\Users\Raakesh R\AppData\Local\Programs\Antigravity IDE\bin\antigravity-ide.cmd" --remote-debugging-port=9015 .
   ```
   *(Ensure the IDE successfully opens your workspace folder).*

---

## Step 2: Validate your Local `.env` Configuration
Open `backend/.env` and verify the three critical Telegram values are set:
```env
# 1. Your official bot token from BotFather
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here

# 2. Your personal numerical user ID (to authorize command execution)
TELEGRAM_USER_ID=your_numerical_telegram_user_id_here

# 3. Custom Cloudflare Worker proxy (Crucial for bypass ISP blocks in India)
TELEGRAM_API_ROOT=https://your-worker-name.your-subdomain.workers.dev
```

---

## Step 3: Run the Node Backend
Open a terminal in the `backend/` directory:
```bash
cd backend
npm start
```
* **What to watch for**: Verify the console prints these success logs:
  - `[Telegram] Bot authenticated as @Rocky...`
  - `[Telegram] ✅ Rocky Bridge active and polling.`
  - `Rocky Backend running on http://0.0.0.0:3001`
  
*(Tip: If you are making code edits, you can run `npm run dev` instead to use Nodemon which auto-restarts the backend on file changes).*

---

## Step 4: Run the Public Tunnel (For Mobile App)
If you want to use the Expo mobile application, you must expose port `3001` via Localtunnel/Ngrok.
Open a **new** terminal in the `backend/` directory and run:
```bash
npm run tunnel
```
* Copy the printed URL (e.g., `https://xxxx.localtunnel.me`) and paste it into the Setup screen of your Rocky mobile app.

---

## Step 5: Test the Telegram Connection
Open Telegram and search for your bot. Send the following commands to check connection health:

* **`/status`**: Checks connection to the IDE. The bot should respond with:
  > 🤖 **Rocky Bridge Status**: active
  > 🖥️ **IDE Status**: idle (or generating)
  > 📖 **Latest IDE response:** [Preview of last message]
  
* **`/result`** (or `/output`): Returns the complete text of the last response generated in the IDE chat window. Useful for checking command results at any time!

---

## 🛠️ Quick Troubleshooting Reminders:
* **"Failed to inject... Reason: busy"**: You tried to send a message while the IDE was already typing/generating. Wait for it to finish, or use `/result` to read the current progress.
* **"CDP not found"**: The IDE was not launched with the `--remote-debugging-port=9015` flag. Close the IDE and restart it using the command in Step 1.
* **"Unauthorized"**: The Telegram account you are messaging from does not have its numerical ID matching `TELEGRAM_USER_ID` in the `.env` file.
