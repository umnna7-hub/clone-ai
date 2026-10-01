require("dotenv").config({ quiet: true });

const http = require("http");

// ============================================================
// SETTINGS
// ============================================================

const PORT = Number(process.env.PORT) || 3001;
const API_KEY = process.env.GEMINI_API_KEY;

// Change with GEMINI_MODEL in .env if this name is not available for you.
const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

// Demo mode: if the AI request fails, return a placeholder reply
// instead of an error. Off by default so real errors stay visible.
const DEMO_MODE = process.env.DEMO_MODE === "true";

// Google's OpenAI-compatible chat endpoint
const API_URL =
    "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

const MAX_HISTORY = 30;      // chat messages sent to the model
const MAX_CHARS = 4000;      // per message
const MAX_BODY = 1000000;    // bytes per request


// ============================================================
// PERSONALITY
// ============================================================

let personality = null;

try {
    personality = require("./personality");
    console.log("Personality file loaded successfully.");
} catch (error) {
    // Only ignore "file not found". A syntax error should be visible.
    if (error.code !== "MODULE_NOT_FOUND") {
        throw error;
    }
    console.log("No personality.js found. Running without personality.");
}

console.log("========================================");
console.log("Teacher AI Backend (Google Gemini)");
console.log("API key detected:", Boolean(API_KEY));
console.log("Model:", MODEL);
console.log("Demo mode:", DEMO_MODE);
console.log("========================================");


// ============================================================
// HELPERS
// ============================================================

function sendJson(response, statusCode, data) {
    response.writeHead(statusCode, {
        "Content-Type": "application/json; charset=utf-8"
    });
    response.end(JSON.stringify(data));
}

function readBody(request) {
    return new Promise((resolve, reject) => {
        let body = "";

        request.setEncoding("utf8"); // keeps Urdu / non-English text intact

        request.on("data", (chunk) => {
            body += chunk;

            if (body.length > MAX_BODY) {
                reject(Object.assign(new Error("Request too large"), { status: 413 }));
                request.destroy();
            }
        });

        request.on("end", () => resolve(body));
        request.on("error", reject);
    });
}

function demoResponse() {
    return "I'm currently running in demo mode, so this is a placeholder reply.";
}


// ============================================================
// CALL GEMINI
// ============================================================

async function askGemini(systemParts, chatMessages) {

    if (!API_KEY) {
        throw new Error("GEMINI_API_KEY is not set. Add it to your .env file.");
    }

    // One combined system message: personality first, then any extra
    // instructions from the frontend (for example the student's name).
    const system = [
        personality && personality.systemPrompt,
        ...systemParts
    ].filter(Boolean).join("\n\n");

    const messages = system
        ? [{ role: "system", content: system }, ...chatMessages]
        : chatMessages;

    console.log(`Sending request to Gemini using model: ${MODEL}`);

    let apiResponse;

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

    const raw = await apiResponse.text();
    let data;

    try {
        data = JSON.parse(raw);
    } catch {
        console.error("Raw response:", raw);
        throw new Error(`Gemini returned invalid JSON (HTTP ${apiResponse.status}).`);
    }

    if (!apiResponse.ok) {
        // Errors sometimes arrive wrapped in an array
        const apiError = (Array.isArray(data) ? data[0]?.error : data.error) || {};

        console.error("GEMINI API ERROR:", apiResponse.status, apiError.message);

        throw new Error(
            apiError.message || `Gemini request failed (HTTP ${apiResponse.status}).`
        );
    }

    const text = data.choices?.[0]?.message?.content;

    if (typeof text !== "string" || !text.trim()) {
        console.error(JSON.stringify(data, null, 2));
        throw new Error("Gemini returned no text in the response.");
    }

    console.log("Gemini response received successfully.");

    return text.trim();
}


// ============================================================
// VALIDATE REQUEST
// ============================================================

// Returns { systemParts, chatMessages } or throws an Error with .status = 400
function parseMessages(messages) {

    const fail = (text) => {
        throw Object.assign(new Error(text), { status: 400 });
    };

    if (!Array.isArray(messages) || messages.length === 0) {
        fail("messages must be a non-empty array");
    }

    const systemParts = [];
    const chatMessages = [];

    for (const message of messages) {

        if (!message || typeof message !== "object") {
            fail("Each message must be an object");
        }

        const { role, content } = message;

        if (!["user", "assistant", "system", "developer"].includes(role)) {
            fail(`Invalid message role: ${role}`);
        }

        if (typeof content !== "string" || !content.trim()) {
            fail("Each message must contain non-empty string content");
        }

        if (content.length > MAX_CHARS) {
            fail(`A message is longer than ${MAX_CHARS} characters`);
        }

        if (role === "system" || role === "developer") {
            systemParts.push(content);
        } else {
            chatMessages.push({ role, content });
        }
    }

    if (chatMessages.length === 0) {
        fail("At least one user message is required");
    }

    return { systemParts, chatMessages: chatMessages.slice(-MAX_HISTORY) };
}


// ============================================================
// SERVER
// ============================================================

const server = http.createServer(async (request, response) => {

    // CORS
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (request.method === "OPTIONS") {
        response.writeHead(204);
        response.end();
        return;
    }

    const path = new URL(request.url, "http://localhost").pathname;


    // ---- Health check ----
    if (request.method === "GET" && (path === "/" || path === "/health")) {
        sendJson(response, 200, {
            status: "online",
            service: "Teacher AI Backend",
            provider: "google-gemini",
            model: MODEL,
            apiKeyDetected: Boolean(API_KEY),
            demoMode: DEMO_MODE
        });
        return;
    }


    // ---- Chat ----
    if (request.method === "POST" && path === "/api/chat") {

        let parsed;

        try {
            const body = await readBody(request);

            let data;
            try {
                data = JSON.parse(body);
            } catch {
                throw Object.assign(new Error("Invalid JSON request"), { status: 400 });
            }

            parsed = parseMessages(data.messages);

        } catch (error) {
            sendJson(response, error.status || 400, { error: error.message });
            return;
        }

        try {
            const reply = await askGemini(parsed.systemParts, parsed.chatMessages);
            sendJson(response, 200, { reply, mode: "gemini" });

        } catch (error) {
            console.error("BACKEND AI ERROR:", error.message);

            if (DEMO_MODE) {
                sendJson(response, 200, {
                    reply: demoResponse(),
                    mode: "demo",
                    warning: error.message
                });
                return;
            }

            sendJson(response, 502, {
                error: "Gemini request failed",
                message: error.message
            });
        }

        return;
    }


    sendJson(response, 404, { error: "Not found" });
});

server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
        console.error(`Port ${PORT} is already in use.`);
        console.error("Stop the old Node.js process and start the server again.");
    } else {
        console.error("Server error:", error);
    }
});

server.listen(PORT, "0.0.0.0", () => {
    console.log(`Backend running at http://localhost:${PORT}`);
});
