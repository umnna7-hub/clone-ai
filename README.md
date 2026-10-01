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

GEMINI_API_KEY=your-key-here

Alternatively, set the variable in your terminal for the current session only.

PowerShell

powershell
$env:GEMINI_API_KEY = "your-key-here"

macOS / Linux

bash
export GEMINI_API_KEY="your-key-here"

Never commit your key. Add .env to .gitignore.

3. Start the backend
bash
node server.js

Expected output:

API key detected: true
Backend running at http://localhost:3001
4. Open the frontend

Open frontend/index.html in your browser. The default backend URL is http://localhost:3001; change it from Settings if needed. To serve the frontend instead:

bash
cd frontend
python -m http.server 5500     # then visit http://localhost:5500

The status under the teacher's name should show a green dot and Online.

Configuration

Backend environment variables:

Variable	Default	Purpose
GEMINI_API_KEY	none (required)	Your Google Gemini API key
GEMINI_MODEL	gemini-3.5-flash-lite	Model name. Change it to one your account can use
PORT	3001	Server port
DEMO_MODE	false	If true, returns placeholder replies when the Gemini request fails

Frontend: configure the backend URL and other preferences in Settings.

API reference
GET /health

Returns server status.

json
{
  "status": "online",
  "service": "Teacher AI Backend",
  "provider": "google-gemini",
  "model": "gemini-3.5-flash-lite",
  "apiKeyDetected": true,
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
messages must be a non-empty array
Allowed roles: user, assistant, system, developer
Each content must be a non-empty string

Success (200):

json
{ "reply": "…", "mode": "gemini" }

Errors: 400 for invalid input, 502 if the Gemini request fails ({ "error", "message" }).

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

This project is intended for local or classroom use. Before any public deployment:

Restrict CORS to your own domain instead of *
Accept only user and assistant roles from clients, so users can't override the personality
Add rate limiting and message length and count limits
Add authentication, since anyone who can reach the server can use your API credits
Chat history is stored in browser localStorage; clear it from Settings on shared devices
If a key is ever exposed, delete it and create a new one
Known limitations
Replies arrive all at once (no streaming)
Chat history is stored only in the browser (localStorage), not on the server
Only the last 30 messages are sent with each request
Tech stack

Node.js (built-in HTTP server and fetch), Gemini-compatible chat completions API, vanilla HTML/CSS/JavaScript. No frontend build step.
