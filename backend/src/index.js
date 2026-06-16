require('dotenv').config();

// Prevent network/socket errors from crashing the server
process.on('uncaughtException', (err) => {
  console.error('[Global] Uncaught Exception:', err.message || err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Global] Unhandled Rejection:', reason?.message || reason);
});

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { exec } = require('child_process');

const { initNotifier } = require('./notifications/notifier');
const { initTelegram } = require('./notifications/telegram');
const { processGoal } = require('./agents/agentEngine');
const modelRouter = require('./models/modelRouter');
const db = require('./utils/database');

const { authenticateToken, JWT_SECRET } = require('./middleware/auth');
const jwt = require('jsonwebtoken');
const mcpManager = require('./utils/mcpManager');


const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const { runArchitectCycle } = require('./agents/architect');

initNotifier(io);

if (process.env.NODE_ENV !== 'test') {
  // Wake the Meta-Architect immediately on startup, and then every 24 hours
  setTimeout(() => {
    runArchitectCycle();
  }, 5000);

  setInterval(() => {
    runArchitectCycle();
  }, 24 * 60 * 60 * 1000);

  db.recoverStaleExecutions(process.env.STALE_EXECUTION_MINUTES || 30)
    .then(({ recoveredGoals, recoveredProjects }) => {
      if (recoveredGoals || recoveredProjects) {
        console.log(`[Recovery] Marked ${recoveredGoals} stale goals and ${recoveredProjects} stale projects as failed`);
      }
    })
    .catch((err) => {
      console.error('[Recovery] Failed to recover stale executions:', err.message);
    });
}

// Socket Auth Handshake
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error("Authentication error"));
  
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return next(new Error("Authentication error"));
    socket.user = decoded;
    next();
  });
});

io.on('connection', (socket) => {
  console.log('Mobile App Connected:', socket.id);
  socket.on('disconnect', () => console.log('Mobile App Disconnected:', socket.id));
  
  socket.on('mobile_trigger_macro', async (data) => {
     if (data.prompt) {
        console.log('[Trigger] Validating macro payload from Secure Client:', data.prompt);
        const { triggerAntigravity } = require('./agents/handoff');
        try {
            await triggerAntigravity(data.prompt);
        } catch (e) {
            console.error('Failed to trigger macro:', e);
        }
     }
  });
});

// Authentication Route
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD || 'rocky123';

  if (password === adminPassword) {
    const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '30d' });
    return res.json({ token });
  }
  res.status(401).json({ error: 'Invalid password' });
});

// Protect all /api routes below
app.use('/api', (req, res, next) => {
  if (req.path === '/login' || req.path === '/status' || req.path === '/tg-status') return next();
  authenticateToken(req, res, next);
});

// API Routes
app.get('/api/goals', async (req, res) => {
  try {
    const goals = await db.getGoals();
    res.json({ goals });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/test-intel', (req, res) => {
  const { notify } = require('./notifications/notifier');
  notify('intel', {
     id: uuidv4(),
     raw: "TEST BLUEPRINT: Pipeline is secure and functional!",
     source: 'META-ARCHITECT'
  });
  res.json({ success: true, message: 'Intel dispatched' });
});

app.get('/api/goals/:goalId', async (req, res) => {
  try {
    const { goalId } = req.params;
    const goal = await db.getGoalById(goalId);
    if (!goal) return res.status(404).json({ error: 'Goal not found' });

    const [projects, logs] = await Promise.all([
      db.getProjectsByGoal(goalId),
      db.getLogsByGoal(goalId),
    ]);
    res.json({ goal, projects, logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/goals', async (req, res) => {
  try {
    const { title, description, imageBase64 } = req.body;
    if (!title) return res.status(400).json({ error: "Title is required" });

    const goalId = uuidv4();
    await db.createGoal(goalId, title, description);
    processGoal(goalId, title, description, imageBase64).catch(console.error);
    res.json({ success: true, goalId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/status', (req, res) => {
  res.json({ status: 'online', time: new Date() });
});

app.get('/api/tg-status', (req, res) => {
  const { getTelegramStatus } = require('./notifications/telegram');
  res.json(getTelegramStatus());
});

app.get('/api/models', (req, res) => {
  res.json(modelRouter.getStats());
});



const axios = require('axios');
const FormData = require('form-data');

const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

app.post('/api/transcribe', upload.single('audioFile'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "audioFile required in multipart" });
    
    // Convert file buffer securely to base64
    const cleanBase64 = req.file.buffer.toString('base64');

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) return res.status(500).json({ error: "GEMINI_API_KEY missing from .env" });

    // Use Gemini 2.5 Flash for ultra-fast, high-quality audio transcription
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        contents: [
          {
            role: "user",
            parts: [
              { text: "Transcribe this audio exactly as spoken. Do not add any extra commentary. If it's silent, return nothing. Return ONLY the raw transcribed text." },
              {
                inlineData: {
                  mimeType: "audio/mp3", // generic fallback or m4a
                  data: cleanBase64
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
        }
      },
      { headers: { "content-type": "application/json" }, timeout: 60000 }
    );

    const transcribedText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    res.json({ success: true, text: transcribedText });
  } catch (err) {
    const errorDetails = err.response?.data ? JSON.stringify(err.response.data) : err.message;
    console.error('[Gemini STT] Error:', errorDetails);
    require('fs').appendFileSync('dev.log', '\\n[Gemini STT] ' + errorDetails);
    res.status(500).json({ error: errorDetails });
  }
});

app.post('/api/reply', (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "Message required" });
  const { notify } = require('./notifications/notifier');
  const reply = `Antigravity: ${message}`;
  notify('log', { message: reply });
  try {
    const { sendTelegramUpdate } = require('./notifications/telegram');
    sendTelegramUpdate(reply);
  } catch (err) {
    console.error('[Telegram Bridge] Failed to forward API reply:', err.message);
  }
  res.json({ success: true });
});

// ── Zero-Click Reverse Handoff Bridge ──
const fs = require('fs');
const path = require('path');
const commsFile = path.join(__dirname, '../../tmp_antigravity_reply.txt');

if (!fs.existsSync(commsFile)) {
  fs.writeFileSync(commsFile, '');
}

fs.watchFile(commsFile, { interval: 500 }, (curr, prev) => {
  if (curr.mtime !== prev.mtime) {
    try {
      const content = fs.readFileSync(commsFile, 'utf8').trim();
      if (content) {
        const { performSelfHealCheck } = require('./agents/healer');
        const { addMemory } = require('./utils/database');
        addMemory("System Architecture Shift", content).catch(() => {});
        performSelfHealCheck(content);
        
        const { notify } = require('./notifications/notifier');
        const reply = `Antigravity: ${content}`;
        notify('log', { message: reply });
        try {
          const { sendTelegramUpdate } = require('./notifications/telegram');
          sendTelegramUpdate(reply);
        } catch (telegramErr) {
          console.error('[Telegram Bridge] Failed to forward Antigravity reply:', telegramErr.message);
        }
        
        fs.writeFileSync(commsFile, ''); 
      }
    } catch(err) {
      console.error('[Zero-Click Bridge] Read Error: ', err.message);
    }
  }
});

module.exports = { app, server };

if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  mcpManager.init()
    .then(() => {
      server.listen(PORT, '0.0.0.0', () => {
        console.log(`Rocky Backend running on http://0.0.0.0:${PORT}`);
        initTelegram();
        
        // Ensure visible terminal windows open for the ecosystem
        if (process.env.NODE_ENV !== 'test') {
            const lockFile = path.join(__dirname, '../../tmp_startup.lock');
            const shouldSpawn = !fs.existsSync(lockFile) || (Date.now() - fs.statSync(lockFile).mtimeMs > 60000);
            
            if (shouldSpawn) {
                fs.writeFileSync(lockFile, 'locked');
                // Removed auto-spawning of tunnel and mobile app per user request
            }
        }
      });
    })
    .catch(err => {
      console.error('[MCP] Fatal initialization error:', err);
      process.exit(1);
    });
}
