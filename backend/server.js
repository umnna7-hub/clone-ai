require("dotenv").config({ quiet: true });

const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();

const PORT = Number(process.env.PORT) || 3001;
const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const DEMO_MODE = process.env.DEMO_MODE === "true";

const API_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const MAX_HISTORY = 30;
const MAX_CHARS = 4000;
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const RETRY_DELAYS_MS = [1000, 2000];

// Load Personality
let personality = null;
try {
    personality = require("./personality");
} catch (error) {
    if (error.code !== "MODULE_NOT_FOUND") throw error;
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// 1. Serve Static Frontend Files
app.use(express.static(path.join(__dirname, '../frontend')));

// Helper for Gemini API Call
async function askGemini(systemParts, chatMessages) {
    if (!API_KEY) {
        throw new Error("GEMINI_API_KEY is not set. Add it to your .env file.");
    }

    const system = [
        personality && personality.systemPrompt,
        ...systemParts
    ].filter(Boolean).join("\n\n");

    const messages = system
        ? [{ role: "system", content: system }, ...chatMessages]
        : chatMessages;

    let apiResponse;
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
        try {
            apiResponse = await fetch(API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${API_KEY}`
                },
                body: JSON.stringify({ model: MODEL, messages }),
                signal: AbortSignal.timeout(60000)
            });
        } catch (error) {
            if (error.name === "TimeoutError") {
                throw new Error("Gemini request timed out after 60 seconds.");
            }
            throw new Error(`Could not connect to Gemini: ${error.message}`);
        }

        if (!RETRYABLE_STATUSES.has(apiResponse.status) || attempt === RETRY_DELAYS_MS.length) break;
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
    }

    const raw = await apiResponse.text();
    let data;
    try {
        data = JSON.parse(raw);
    } catch {
        throw new Error(`Gemini returned invalid JSON (HTTP ${apiResponse.status}).`);
    }

    if (!apiResponse.ok) {
        const apiError = (Array.isArray(data) ? data[0]?.error : data.error) || {};
        throw new Error(apiError.message || `Gemini request failed (HTTP ${apiResponse.status}).`);
    }

    const text = data.choices?.[0]?.message?.content;
    if (typeof text !== "string" || !text.trim()) {
        throw new Error("Gemini returned no text in the response.");
    }

    return text.trim();
}

function parseMessages(messages) {
    if (!Array.isArray(messages) || messages.length === 0) {
        throw Object.assign(new Error("messages must be a non-empty array"), { status: 400 });
    }

    const systemParts = [];
    const chatMessages = [];

    for (const message of messages) {
        if (!message || typeof message !== "object") {
            throw Object.assign(new Error("Each message must be an object"), { status: 400 });
        }
        const { role, content } = message;

        if (!["user", "assistant", "system", "developer"].includes(role)) {
            throw Object.assign(new Error(`Invalid message role: ${role}`), { status: 400 });
        }
        if (typeof content !== "string" || !content.trim()) {
            throw Object.assign(new Error("Each message must contain non-empty string content"), { status: 400 });
        }
        if (content.length > MAX_CHARS) {
            throw Object.assign(new Error(`A message is longer than ${MAX_CHARS} characters`), { status: 400 });
        }

        if (role === "system" || role === "developer") {
            systemParts.push(content);
        } else {
            chatMessages.push({ role, content });
        }
    }

    if (chatMessages.length === 0) {
        throw Object.assign(new Error("At least one user message is required"), { status: 400 });
    }

    return { systemParts, chatMessages: chatMessages.slice(-MAX_HISTORY) };
}

// 2. API Routes
app.get('/health', (req, res) => {
    res.json({
        status: "online",
        service: "Teacher AI Backend",
        provider: "google-gemini",
        model: MODEL,
        apiKeyDetected: Boolean(API_KEY),
        demoMode: DEMO_MODE
    });
});

app.post('/api/chat', async (req, res) => {
    try {
        const parsed = parseMessages(req.body.messages);
        const reply = await askGemini(parsed.systemParts, parsed.chatMessages);
        res.json({ reply, mode: "gemini" });
    } catch (error) {
        if (DEMO_MODE) {
            res.json({
                reply: "I'm currently running in demo mode, so this is a placeholder reply.",
                mode: "demo",
                warning: error.message
            });
            return;
        }
        res.status(error.status || 502).json({
            error: "Gemini request failed",
            message: error.message
        });
    }
});

// 3. Fallback Route: Serve index.html for root or any unknown non-API routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend running on port ${PORT}`);
});