# AI Email & Calendar Assistant

A Claude-powered agent that reads/sends Gmail emails and manages Google Calendar events via a Next.js chat UI.

**Stack:** Next.js 15 · TypeScript · Claude API (Anthropic) · NextAuth · Gmail API · Google Calendar API · Tailwind CSS

---

## Prerequisites

- Node.js 18+ installed
- An Anthropic account (for Claude API key)
- A Google account

---

## Step 1 — Get an Anthropic API Key

1. Go to https://console.anthropic.com
2. Sign in or create an account
3. Navigate to **API Keys** → **Create Key**
4. Copy the key — you'll need it shortly

---

## Step 2 — Set Up Google OAuth (Gmail + Calendar access)

You need to create a Google Cloud project and OAuth credentials.

### 2a. Create a Google Cloud Project
1. Go to https://console.cloud.google.com
2. Click the project dropdown at the top → **New Project**
3. Name it (e.g. "AI Assistant") → **Create**

### 2b. Enable APIs
1. In your project, go to **APIs & Services** → **Library**
2. Search for and enable:
   - **Gmail API**
   - **Google Calendar API**

### 2c. Create OAuth Credentials
1. Go to **APIs & Services** → **OAuth consent screen**
2. Choose **External** → **Create**
3. Fill in:
   - App name: `AI Assistant`
   - User support email: your email
   - Developer contact: your email
4. Click **Save and Continue** through the rest (no need to add scopes here)
5. On the **Test users** page, add your Google email address
6. Click **Save and Continue** → **Back to Dashboard**

7. Now go to **APIs & Services** → **Credentials**
8. Click **+ Create Credentials** → **OAuth client ID**
9. Application type: **Web application**
10. Name: `AI Assistant Local`
11. Under **Authorized redirect URIs**, add:
    ```
    http://localhost:3000/api/auth/callback/google
    ```
12. Click **Create**
13. Copy the **Client ID** and **Client Secret**

---

## Step 3 — Configure Environment Variables

Copy the example env file:
```bash
cp .env.local.example .env.local
```

Edit `.env.local` and fill in your values:
```env
ANTHROPIC_API_KEY=sk-ant-...          # from Step 1
GOOGLE_CLIENT_ID=...apps.googleusercontent.com   # from Step 2c
GOOGLE_CLIENT_SECRET=GOCSPX-...       # from Step 2c
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=...                   # generate below
```

Generate a secure NEXTAUTH_SECRET:
```bash
openssl rand -base64 32
```
Paste the output as your `NEXTAUTH_SECRET`.

---

## Step 4 — Install Dependencies & Run

```bash
npm install
npm run dev
```

Open http://localhost:3000 in your browser.

---

## Usage

1. Click **Sign in with Google** and authorize the app
2. Start chatting! Try:
   - _"Show my last 5 emails"_
   - _"What's on my calendar this week?"_
   - _"Schedule a meeting with john@example.com tomorrow at 3pm for 1 hour"_
   - _"Send an email to sarah@example.com with subject 'Hello' and say hi"_

---

## Project Structure

```
ai-email-calendar-assistant/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts   # Google OAuth handler
│   │   └── chat/route.ts                 # Claude agent + agentic loop
│   ├── layout.tsx
│   ├── page.tsx
│   ├── providers.tsx
│   └── globals.css
├── components/
│   └── ChatUI.tsx                        # Chat interface
├── lib/
│   └── tools.ts                          # Gmail + Calendar tool definitions & implementations
├── .env.local.example
├── package.json
└── README.md
```

## How It Works

1. User sends a message in the chat UI
2. The `/api/chat` route sends the conversation to Claude with 4 tool definitions:
   - `read_emails` — lists Gmail messages
   - `send_email` — sends a Gmail message
   - `list_events` — lists Google Calendar events
   - `create_event` — creates a new calendar event
3. Claude decides which tools to call (if any) and the agent loop executes them against the live APIs
4. The final response is returned to the UI

---

## Troubleshooting

**"redirect_uri_mismatch" error** — Make sure `http://localhost:3000/api/auth/callback/google` is in your Google OAuth authorized redirect URIs exactly as written.

**"Access blocked: app not verified"** — Your app is in test mode. Go to OAuth consent screen → Test users → add your Google email.

**Gmail/Calendar returning 403** — Make sure you enabled both APIs in Google Cloud Console (Step 2b).

**"Not authenticated" error from the chat API** — Sign out and sign back in to refresh your Google OAuth token.
