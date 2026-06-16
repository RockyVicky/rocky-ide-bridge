# Rocky Integration Troubleshooting Guide 🔧

This document compiles common errors encountered during the installation, startup, and execution of the Rocky Mobile-to-IDE Bridge and provides clear steps to resolve them.

---

## 1. Connection & Injection Failures

### 🔴 Error: "Failed to inject into IDE. Reason: busy"
* **Symptom**: When sending a text prompt or triggering a macro from your mobile phone or Telegram, you receive a reply: `Failed to inject into IDE. Reason: busy. Make sure the Antigravity chat window is visible and not busy.`
* **Cause**: The backend was able to connect to the IDE over Chrome DevTools Protocol (CDP), but the IDE chat panel is currently occupied. The backend detects this by checking if the "Cancel / Stop generation" button is active (visible) in the chat UI.
* **Solutions**:
  1. **Wait for completion**: If the IDE agent is in the middle of executing a plan or running terminal scripts, let it finish. Once it returns to an `idle` state (the send arrow icon reappears), you can send your next command.
  2. **Stuck loop**: If the agent is stuck in an infinite loop, click the **Stop / Cancel** button manually in the IDE chat panel to release the busy lock.
  3. **Interface check**: Make sure the chat or prompt side panel in the IDE is actually open and visible. If the panel is minimized or collapsed, the script may not find the input field properly.

---

### 🔴 Error: "Could not connect to Antigravity IDE. Error: CDP not found"
* **Symptom**: The backend fails to establish a connection with the editor and reports that it can't find a debuggable workbench.
* **Cause**: The IDE was not launched with the remote debugging port active, or it is running on a port not scanned by Rocky. By default, Rocky scans the following ports for a valid VS Code / Antigravity workbench target: `[9000, 9001, 9002, 9003, 9012, 9013, 9014, 9015]`.
* **Solutions**:
  1. **Verify IDE command**: Ensure you started the IDE from the command line using the `--remote-debugging-port` flag:
     ```bash
     antigravity-ide.cmd --remote-debugging-port=9015 .
     ```
  2. **Add Custom Ports**: If your IDE is running on a different port (e.g., `9222`), open [backend/src/agents/cdpBridge.js](file:///e:/Autonomous/files/jarvis/backend/src/agents/cdpBridge.js) and add your custom port to the `PORTS` array at the top of the file:
     ```javascript
     const PORTS = [9000, 9001, 9002, 9003, 9012, 9013, 9014, 9015, 9222];
     ```
  3. **Check Port Binding**: Run `netstat -ano | findstr 9015` in Windows PowerShell to verify that the IDE is successfully listening on that port.

---

## 2. Remote Tunnel & Networking Issues

### 🟡 Warning: "Ngrok connection failed: authtoken missing"
* **Symptom**: The console shows a warning: `[Ngrok] Connection failed: ... authtoken missing. Falling back to localtunnel...`
* **Cause**: Rocky tries to use Ngrok for high-stability connections, but it requires a free authentication token to host public sockets.
* **Solutions**:
  1. **Set up Ngrok (Recommended)**:
     - Sign up for a free account at [ngrok.com](https://ngrok.com/).
     - Copy your Auth Token from the Ngrok dashboard.
     - Add it to your `backend/.env` file:
       ```env
       NGROK_AUTHTOKEN=your_ngrok_auth_token_here
       ```
  2. **Let Localtunnel handle it**: If you do not provide a token, Rocky automatically falls back to Localtunnel. If Localtunnel connections fail due to rate limits or ISP restrictions, Ngrok is the preferred route.

---

### 🔴 Error: Telegram Connection Timed Out (Regional ISP Blocks)
* **Symptom**: The backend console hangs or prints connection timeouts (`ETIMEDOUT` or `ECONNRESET`) when trying to start or talk to the Telegram Bot API.
* **Cause**: Some ISPs (especially in India) block or throttle connections to the default `api.telegram.org` servers.
* **Solutions**:
  1. **Cloudflare Worker Reverse Proxy**: Set up a free Cloudflare Worker to act as a proxy.
     - Deploy a Cloudflare worker with this fetch handler:
       ```javascript
       addEventListener('fetch', event => {
         event.respondWith(handleRequest(event.request))
       })
       async function handleRequest(request) {
         const url = new URL(request.url)
         url.hostname = 'api.telegram.org'
         return fetch(url.toString(), {
           method: request.method,
           headers: request.headers,
           body: request.body
         })
       }
       ```
     - Define the URL in your `backend/.env`:
       ```env
       TELEGRAM_API_ROOT=https://your-worker-name.your-subdomain.workers.dev
       ```

---

## 3. Authentication & Authorization Errors

### 🔴 Error: "Unauthorized attempt from ID"
* **Symptom**: When trying to message the Telegram Bot, it replies with `Unauthorized.` and the backend console logs `[Telegram] Unauthorized attempt from ID: XXXXXXXXX`.
* **Cause**: To prevent strangers from accessing your local workstation files and executing remote terminal commands, Rocky has a strict security gate. Only the user ID configured in the `.env` file can control the bridge.
* **Solutions**:
  1. **Configure your User ID**:
     - Check the backend console output to find your user ID: `[Telegram] Unauthorized attempt from ID: 12345678`.
     - Copy this number.
     - Open `backend/.env` and update the value:
       ```env
       TELEGRAM_USER_ID=12345678
       ```
     - Restart the backend.

---

### 🔴 Error: "Authentication error" on Socket connection
* **Symptom**: The mobile app Setup screen shows a generic authentication or socket handshake failure.
* **Cause**: The Socket connection requires a JWT token. This token is acquired by submitting the password to the `/api/login` endpoint.
* **Solutions**:
  1. **Verify password**: Make sure the password in the mobile app Setup screen matches the `ADMIN_PASSWORD` defined in the backend's `.env` (defaults to `rocky123` if not defined).

---

## 4. Startup Script Failures

### 🔴 Error: "[CRITICAL ERROR] Drive E: is not accessible"
* **Symptom**: Running `start_rocky.bat` or `manual_boot.bat` displays an error message and stops.
* **Cause**: The startup scripts contain a drive verification line (`if not exist "e:\"`) because the original development project workspace was hosted on an external drive (`E:\`).
* **Solutions**:
  1. **Modify the bat file**: Open the startup batch script (`start_rocky.bat` or `manual_boot.bat`) in a text editor.
  2. Modify or remove lines 10–17 (the drive check) and change the target folder to your local workspace directory (e.g., `C:\Projects\jarvis` instead of `e:\Autonomous\files\jarvis`).
