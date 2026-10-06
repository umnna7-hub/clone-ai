Ask Mr. Saleem: AI Teacher Chatbot

A ChatGPT-style chat application that answers as an AI representation of Mr. Muhammad Saleem, a Computer Science lecturer. It has a Node.js backend that calls Google's Gemini API with a custom teacher personality, and a responsive single-file frontend.

This is an AI representation built from provided background and style notes. It is not the real person and can make mistakes.

Features
Teacher personality: serious when needed, witty, strict but supportive, mixing Urdu (Roman) and English
Focused on Java, OOP, and programming concepts
Responsive chat interface for desktop and mobile, with dark mode
Addresses the student by name (optional name entry)
Typing indicator and starter questions
Multiple saved conversations, with individual and bulk delete
Settings for student name, appearance, backend URL, and send-key behavior
Live server status indicator and clear error messages
Optional demo mode for testing without a working API
Project structure
clone-ai/
├── backend/
│   ├── server.js              # HTTP server + Gemini integration
│   ├── personality.js         # Teacher system prompt
│   ├── package.json
│   └── package-lock.json
└── frontend/
    └── index.html             # Chat UI, history, and settings
Requirements
Node.js 18 or newer
A Google Gemini API key
Setup
1. Install backend dependencies
bash
cd backend
npm install
2. Add your API key

Create a file named .env in backend/:

```dotenv
GEMINI_API_KEY=your-key-here
APP_ACCESS_TOKEN=replace-with-a-random-secret-at-least-32-characters-long
```

Generate an access token with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
Alternatively, set both variables in your terminal for the current session only.

PowerShell

powershell
$env:GEMINI_API_KEY = "your-key-here"
$env:APP_ACCESS_TOKEN = "paste-the-generated-32-character-or-longer-secret-here"

macOS / Linux

bash
export GEMINI_API_KEY="your-key-here"
export APP_ACCESS_TOKEN="paste-the-generated-32-character-or-longer-secret-here"

Never commit your key. Add .env to .gitignore.

3. Start the backend
bash
node server.js

Expected output:

Server running successfully on port 3001
4. Open the app

Visit http://localhost:3001. The backend serves the frontend and API from the same origin. In Settings, enter the `APP_ACCESS_TOKEN` value you configured above.

The deployed origin is selected automatically when the app is served over HTTP(S). If you host the frontend separately, set the backend URL and access token in Settings, and configure `FRONTEND_ORIGIN` on the backend.

Configuration

Backend environment variables:

Variable	Default	Purpose
GEMINI_API_KEY	none (required)	Your Google Gemini API key
APP_ACCESS_TOKEN	none (required)	Shared bearer token; must be at least 32 characters
FRONTEND_ORIGIN	unset	Optional exact origin allowed to call the API cross-origin; unset disables cross-origin access
GEMINI_MODEL	gemini-1.5-flash	Model name. Change it to one your account can use
PORT	3001	Server port
DEMO_MODE	false	If true, returns placeholder replies when the Gemini request fails

Frontend: configure the backend URL, app access token, and other preferences in Settings. The access token is stored in that browser's local storage; only use it over HTTPS and avoid shared devices.

API reference
GET /health

Returns server status.

json
{
  "status": "online",
  "service": "Teacher AI Backend",
  "provider": "google-gemini",
  "model": "gemini-1.5-flash",
  "demoMode": false
}
POST /api/chat

Request:

json
{
  "messages": [
    { "role": "user", "content": "Explain encapsulation in Java" }
  ]
}
Send `Authorization: Bearer <APP_ACCESS_TOKEN>`.
`messages` must contain 1–30 items. Allowed roles are `user` and `assistant`; each content must be a non-empty string of at most 4,000 characters. The server adds its own teacher personality prompt.

Success (200):

json
{ "reply": "…", "mode": "gemini" }

Errors: 400 for invalid input, 401 for missing/invalid access token, 429 for rate limits, and 502 if the Gemini request fails (`{ "error", "message" }`).

Customizing the personality

Edit backend/personality.js. The systemPrompt string controls tone, teaching style, language mix, and boundaries. Restart the server after changes.

Troubleshooting
Problem	Fix
Status shows "Server offline"	Start the backend, and check the backend URL in Settings
API key detected: false	The key isn't set in this terminal, or dotenv isn't loaded in server.js
Gemini quota or billing error	Check your Gemini API project and quota
Error about the model	Set GEMINI_MODEL to a model your account can access
Port 3001 is already in use	Stop the old Node process, or set a different PORT and update the backend URL in Settings
PowerShell rejects the key command	Use $env:GEMINI_API_KEY = "your-key" (variable name, then =, then the key in quotes)

Demo mode only activates after a Gemini request fails, so GEMINI_API_KEY still needs to be set.

Security notes

This project is intended for local or classroom use. The API requires an access token, accepts only user/assistant messages with bounded sizes, and limits each IP to 30 chat requests per 15 minutes. This is a shared token, not per-user authentication: anyone who receives it can use the API and its Gemini quota. Cross-origin requests are disabled by default; when hosting the frontend separately, set `FRONTEND_ORIGIN` to its exact HTTPS origin. The limiter uses in-memory state, so requests are counted per server instance. Chat history and the access token are stored in browser localStorage; clear them on shared devices. Never expose either secret, and rotate it immediately if exposed.
Known limitations
Replies arrive all at once (no streaming)
Chat history is stored only in the browser (localStorage), not on the server
Only the last 30 messages are sent with each request
Tech stack

Node.js (built-in HTTP server and fetch), Gemini-compatible chat completions API, vanilla HTML/CSS/JavaScript. No frontend build step.
