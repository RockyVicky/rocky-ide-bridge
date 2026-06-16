const axios = require("axios");

// All supported models with their API configs
const MODEL_CONFIGS = {
  "qwen2.5-coder:7b": {
    name: "Qwen 2.5 Coder (7B)",
    apiUrl: "http://localhost:11434/api/chat",
    keyEnv: null,
    provider: "ollama",
    maxTokens: 8096,
  },
  "gemma2:9b": {
    name: "Gemma 2 (9B)",
    apiUrl: "http://localhost:11434/api/chat",
    keyEnv: null,
    provider: "ollama",
    maxTokens: 8096,
  },
  "gpt-4o": {
    name: "GPT-4o (Omni)",
    apiUrl: "https://api.openai.com/v1/chat/completions",
    keyEnv: "OPENAI_API_KEY",
    provider: "openai",
    maxTokens: 16384,
  },
  "gpt-4o-mini": {
    name: "GPT-4o Mini",
    apiUrl: "https://api.openai.com/v1/chat/completions",
    keyEnv: "OPENAI_API_KEY",
    provider: "openai",
    maxTokens: 16384,
  },
  "gpt-5.5": {
    name: "GPT-5.5 (Agentic)",
    apiUrl: "https://api.openai.com/v1/chat/completions",
    keyEnv: "OPENAI_API_KEY",
    provider: "openai",
    maxTokens: 16384,
  },
  "claude-sonnet-5": {
    name: "Claude Sonnet 5 (Fennec)",
    apiUrl: "https://api.anthropic.com/v1/messages",
    keyEnv: "ANTHROPIC_API_KEY",
    provider: "anthropic",
    maxTokens: 16384,
  },
  "claude-opus-4.7": {
    name: "Claude Opus 4.7",
    apiUrl: "https://api.anthropic.com/v1/messages",
    keyEnv: "ANTHROPIC_API_KEY",
    provider: "anthropic",
    maxTokens: 16384,
  },
  "gemini-2.5-pro": {
    name: "Gemini 2.5 Pro",
    apiUrl: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent",
    keyEnv: "GEMINI_API_KEY",
    provider: "gemini",
    maxTokens: 8096,
  },
  "gemini-2.5-flash": {
    name: "Gemini 2.5 Flash",
    apiUrl: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    keyEnv: "GEMINI_API_KEY",
    provider: "gemini",
    maxTokens: 8096,
  },
  "gemini-3.1-pro": {
    name: "Gemini 3.1 Pro",
    apiUrl: "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent",
    keyEnv: "GEMINI_API_KEY",
    provider: "gemini",
    maxTokens: 16384,
  },
  "kimi-k2.6": {
    name: "Kimi K2.6",
    apiUrl: "https://api.moonshot.cn/v1/chat/completions",
    keyEnv: "KIMI_API_KEY",
    provider: "openai",
    maxTokens: 8096,
  },
  "nemotron-3-nano-omni": {
    name: "NVIDIA Nemotron 3 Nano Omni",
    apiUrl: "https://integrate.api.nvidia.com/v1/chat/completions",
    keyEnv: "NVIDIA_API_KEY",
    provider: "openai",
    maxTokens: 8096,
  },
  "anthropic/claude-3.7-sonnet": {
    name: "Claude 3.7 Sonnet (via OpenRouter)",
    apiUrl: "https://openrouter.ai/api/v1/chat/completions",
    keyEnv: "OPENROUTER_API_KEY",
    provider: "openai",
    maxTokens: 2000,
  },
  "openai/gpt-5.5": {
    name: "GPT-5.5 (Agentic)",
    apiUrl: "https://openrouter.ai/api/v1/chat/completions",
    keyEnv: "OPENROUTER_API_KEY",
    provider: "openai",
    maxTokens: 2000,
  },
  "deepseek/deepseek-chat": {
    name: "DeepSeek V3",
    apiUrl: "https://openrouter.ai/api/v1/chat/completions",
    keyEnv: "OPENROUTER_API_KEY",
    provider: "openai",
    maxTokens: 16384,
  }
};

class ModelRouter {
  constructor() {
    this.priority = (process.env.MODEL_PRIORITY || "qwen2.5-coder:7b,gemma2:9b,gemini-2.5-pro,gpt-4o")
      .split(",")
      .map((m) => m.trim())
      .filter((m) => MODEL_CONFIGS[m]);

    this.currentIndex = 0;
    this.failedModels = new Set();
    this.usageStats = {};

    // Reset failed models every hour so they get retried
    setInterval(() => {
      this.failedModels.clear();
      console.log("[ModelRouter] Reset failed models list");
    }, 60 * 60 * 1000);
  }

  getCurrentModel() {
    // Find next available model that hasn't failed
    for (let i = 0; i < this.priority.length; i++) {
      const model = this.priority[i];
      if (!this.failedModels.has(model)) {
        const config = MODEL_CONFIGS[model];
        if (config && (config.keyEnv === null || process.env[config.keyEnv])) {
          return model;
        }
      }
    }
    // If all failed, reset and try again from start
    this.failedModels.clear();
    return this.priority[0];
  }

  markFailed(modelId, reason) {
    console.warn(`[ModelRouter] Marking ${modelId} as failed: ${reason}`);
    this.failedModels.add(modelId);
  }

  getStats() {
    return {
      currentModel: this.getCurrentModel(),
      failedModels: [...this.failedModels],
      usageStats: this.usageStats,
      availableModels: this.priority.map((m) => ({
        id: m,
        name: MODEL_CONFIGS[m]?.name,
        available: !this.failedModels.has(m) && (MODEL_CONFIGS[m]?.keyEnv === null || !!process.env[MODEL_CONFIGS[m]?.keyEnv]),
      })),
    };
  }

  // ── Core call function with auto-fallback ──────────────
  async call(messages, systemPrompt = "", retryCount = 0, forceModelId = null) {
    const modelId = forceModelId || this.getCurrentModel();
    const config = MODEL_CONFIGS[modelId];

    if (!config) throw new Error("No models available");

    const apiKey = config.keyEnv ? process.env[config.keyEnv] : null;
    if (config.keyEnv !== null && !apiKey) {
      this.markFailed(modelId, "No API key");
      if (retryCount < this.priority.length) {
        return this.call(messages, systemPrompt, retryCount + 1, null); // Drop forceModelId to fallback locally
      }
      throw new Error("No API keys configured for any model");
    }

    // Track usage
    if (!this.usageStats[modelId]) this.usageStats[modelId] = 0;
    this.usageStats[modelId]++;

    try {
      console.log(`[ModelRouter] Calling ${config.name}...`);
      const result = await this._callProvider(config, modelId, apiKey, messages, systemPrompt);
      return { ...result, modelUsed: modelId, modelName: config.name };
    } catch (err) {
      console.warn(`[ModelRouter] Error calling model ${config.name} (${modelId}):`, err.message || err);
      this.markFailed(modelId, err.message || 'Unknown error');
      
      if (retryCount < this.priority.length - 1) {
        console.log(`[ModelRouter] Switching to next model...`);
        return this.call(messages, systemPrompt, retryCount + 1, null); // Drop forceModelId to fall back
      }
      throw err;
    }
  }

  async _callProvider(config, modelId, apiKey, messages, systemPrompt) {
    if (config.provider === "ollama") {
      return this._callOllama(config, modelId, messages, systemPrompt);
    } else if (config.provider === "anthropic") {
      return this._callAnthropic(config, modelId, apiKey, messages, systemPrompt);
    } else if (config.provider === "openai") {
      return this._callOpenAI(config, modelId, apiKey, messages, systemPrompt);
    } else if (config.provider === "gemini") {
      return this._callGemini(config, apiKey, messages, systemPrompt);
    }
    throw new Error(`Unknown provider: ${config.provider}`);
  }

  async _callOllama(config, modelId, messages, systemPrompt) {
    const ollamaMessages = [];
    if (systemPrompt) ollamaMessages.push({ role: "system", content: systemPrompt });
    ollamaMessages.push(...messages.map((m) => ({ role: m.role, content: m.content })));

    const temperature = Number(process.env.OLLAMA_TEMPERATURE || 0.1);
    const numCtx = Number(process.env.OLLAMA_NUM_CTX || config.maxTokens || 8192);
    const numPredict = Number(process.env.OLLAMA_NUM_PREDICT || 2048);
    const topP = Number(process.env.OLLAMA_TOP_P || 0.9);
    const repeatPenalty = Number(process.env.OLLAMA_REPEAT_PENALTY || 1.05);

    try {
      const response = await axios.post(
        config.apiUrl,
        {
          model: modelId,
          messages: ollamaMessages,
          stream: false,
          options: {
            temperature,
            num_ctx: numCtx,
            num_predict: numPredict,
            top_p: topP,
            repeat_penalty: repeatPenalty,
          }
        },
        { timeout: 300000 } // Local models might take a while
      );
      let tokens = 0;
      if (response.data.eval_count) {
         tokens = response.data.eval_count + (response.data.prompt_eval_count || 0);
      }
      return { content: response.data.message.content, tokens };
    } catch (err) {
      const enhancedError = new Error(`Ollama Error: Make sure it is running on ${config.apiUrl}. Details: ${err.message}`);
      enhancedError.response = err.response; // Preserve the HTTP response so the fallback router can see the 500 status!
      throw enhancedError;
    }
  }

  async _callAnthropic(config, modelId, apiKey, messages, systemPrompt) {
    const response = await axios.post(
      config.apiUrl,
      {
        model: modelId,
        max_tokens: config.maxTokens,
        system: systemPrompt || "You are Rocky, an autonomous coding agent.",
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      },
      {
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        timeout: 120000,
      }
    );
    return { content: response.data.content[0].text };
  }

  async _callOpenAI(config, modelId, apiKey, messages, systemPrompt) {
    const openaiMessages = [];
    if (systemPrompt) openaiMessages.push({ role: "system", content: systemPrompt });
    openaiMessages.push(...messages.map((m) => {
      if (m.image_base64) {
        return {
          role: m.role,
          content: [
            { type: "text", text: m.content },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${m.image_base64}` } }
          ]
        };
      }
      return { role: m.role, content: m.content };
    }));

    const response = await axios.post(
      config.apiUrl,
      {
        model: modelId,
        max_tokens: config.maxTokens,
        temperature: Number(process.env.OPENAI_TEMPERATURE || 0.1),
        messages: openaiMessages
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          ...(config.apiUrl.includes("openrouter.ai") ? {
            "HTTP-Referer": "https://github.com/Antigravity-AI",
            "X-Title": "Rocky Autonomous Backend"
          } : {})
        },
        timeout: 120000,
      }
    );
    return { content: response.data.choices[0].message.content };
  }

  async _callGemini(config, apiKey, messages, systemPrompt) {
    const contents = messages.map((m) => {
      const parts = [{ text: m.content }];
      if (m.image_base64) {
        parts.push({
          inlineData: {
            mimeType: "image/jpeg",
            data: m.image_base64
          }
        });
      }
      return {
        role: m.role === "assistant" ? "model" : "user",
        parts
      };
    });

    const response = await axios.post(
      `${config.apiUrl}?key=${apiKey}`,
      {
        contents,
        systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
        generationConfig: {
          maxOutputTokens: config.maxTokens,
          temperature: Number(process.env.GEMINI_TEMPERATURE || 0.1),
        },
      },
      { headers: { "content-type": "application/json" }, timeout: 120000 }
    );
    let tokens = 0;
    if (response.data.usageMetadata) tokens = response.data.usageMetadata.totalTokenCount;
    return { content: response.data.candidates[0].content.parts[0].text, tokens };
  }
}

module.exports = new ModelRouter();
