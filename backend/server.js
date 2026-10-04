require("dotenv").config({ quiet: true });

const express = require('express');
const path = require('path');

// Safe CORS handling if package fails to load
let cors;
try {
    cors = require('cors');
} catch (e) {
    cors = () => (req, res, next) => next();
}

const app = express();

const PORT = process.env.PORT || 3001;
const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";
const DEMO_MODE = process.env.DEMO_MODE === "true";

const API_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const MAX_HISTORY = 30;

// Enable CORS and Body Parsing
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// 1. Serve Static Frontend Files
const staticPath = path.join(__dirname, '../frontend');
app.use(express.static(staticPath));

// 2. Health Route
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

// Helper Function for Gemini
async function askGemini(chatMessages) {
    if (!API_KEY) {
        throw new Error("GEMINI_API_KEY environment variable is missing.");
    }

    const response = await fetch(API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${API_KEY}`
        },
        body: JSON.stringify({
            model: MODEL,
            messages: chatMessages
        })
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error?.message || `Gemini API error (HTTP ${response.status})`);
    }

    return data.choices?.[0]?.message?.content?.trim() || "No response received.";
}

// 3. API Chat Endpoint
app.post('/api/chat', async (req, res) => {
    try {
        const { messages } = req.body;
        if (!Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({ error: "messages must be a non-empty array" });
        }

        const reply = await askGemini(messages.slice(-MAX_HISTORY));
        res.json({ reply, mode: "gemini" });
    } catch (error) {
        if (DEMO_MODE) {
            return res.json({
                reply: "Running in demo mode. Please configure GEMINI_API_KEY.",
                mode: "demo"
            });
        }
        res.status(500).json({
            error: "Gemini request failed",
            message: error.message
        });
    }
});

// 4. Fallback: Serve frontend/index.html for root and other non-API routes
app.get('*', (req, res) => {
    res.sendFile(path.join(staticPath, 'index.html'));
});

// Start Express Server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running successfully on port ${PORT}`);
});