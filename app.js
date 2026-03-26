// ─── CONFIG ────────────────────────────────────────────────────────────────────
// Replace with your real Anthropic API key.
// WARNING: In a real app, NEVER expose your API key in frontend JS.
// Route calls through your own backend server instead.
const ANTHROPIC_API_KEY = 'YOUR_ANTHROPIC_API_KEY_HERE';

const GMAIL_MCP_URL  = 'https://gmail.mcp.claude.com/mcp';
const GCAL_MCP_URL   = 'https://gcal.mcp.claude.com/mcp';

const SYSTEM_PROMPT = `You are an intelligent AI Email & Calendar Assistant. You have access to two MCP tools:
1. Gmail MCP — use it to read emails, search inbox, draft and send emails.
2. Google Calendar MCP — use it to list upcoming events, create, update, or delete events.

When users ask about emails or calendar events, ALWAYS use the appropriate MCP tool to fetch real data. Never make up emails or events.

When presenting results:
- For emails: show sender, subject, date, and a short preview. List them clearly.
- For calendar events: show title, date/time, and location if available.
- Be concise, helpful, and proactive. If something needs follow-up, suggest it.
- When drafting emails, show the draft clearly and ask for confirmation before sending.
- Format responses cleanly using line breaks.`;

// ─── STATE ─────────────────────────────────────────────────────────────────────
let messages  = [];
let isLoading = false;

// ─── UI HELPERS ────────────────────────────────────────────────────────────────
function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 200) + 'px';
}

function handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

function sendSuggestion(text) {
  document.getElementById('inputField').value = text;
  sendMessage();
}

function scrollBottom() {
  const wrap = document.getElementById('messagesWrap');
  wrap.scrollTop = wrap.scrollHeight;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatMessage(text) {
  return escapeHtml(text)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g,
      '<code style="background:var(--surface2);padding:1px 5px;border-radius:4px;font-family:\'DM Mono\',monospace;font-size:12px">$1</code>')
    .replace(/\n/g, '<br>');
}

// ─── RESET ─────────────────────────────────────────────────────────────────────
function resetChat() {
  messages = [];
  document.getElementById('messagesInner').innerHTML = getWelcomeHTML();
}

function getWelcomeHTML() {
  return `
    <div class="welcome" id="welcome">
      <div class="welcome-icon">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="4" width="20" height="16" rx="2"/>
          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
        </svg>
      </div>
      <h1>Your AI inbox & calendar</h1>
      <p>I can read and send emails, schedule meetings, and manage your calendar — all through natural conversation.</p>
      <div class="suggestion-grid">
        <div class="suggestion-card" onclick="sendSuggestion('Show me my unread emails from today')">
          <div class="sug-label green">Gmail</div>
          <div class="sug-text">Show me my unread emails from today</div>
        </div>
        <div class="suggestion-card" onclick="sendSuggestion('What meetings do I have this week?')">
          <div class="sug-label blue">Calendar</div>
          <div class="sug-text">What meetings do I have this week?</div>
        </div>
        <div class="suggestion-card" onclick="sendSuggestion('Draft a reply to the latest email from my manager')">
          <div class="sug-label green">Gmail</div>
          <div class="sug-text">Draft a reply to the latest email from my manager</div>
        </div>
        <div class="suggestion-card" onclick="sendSuggestion('Schedule a 1-hour team sync for next Tuesday at 2pm')">
          <div class="sug-label blue">Calendar</div>
          <div class="sug-text">Schedule a team sync for next Tuesday at 2pm</div>
        </div>
      </div>
    </div>`;
}

// ─── DOM BUILDERS ──────────────────────────────────────────────────────────────
function appendUserMsg(text) {
  const welcome = document.getElementById('welcome');
  if (welcome) welcome.remove();

  const inner = document.getElementById('messagesInner');
  const div   = document.createElement('div');
  div.className = 'msg-row user';
  div.innerHTML = `
    <div class="msg-avatar avatar-user">U</div>
    <div class="msg-content">
      <div class="msg-name">You</div>
      <div class="msg-bubble bubble-user">${escapeHtml(text)}</div>
    </div>`;
  inner.appendChild(div);
  scrollBottom();
}

function appendThinking() {
  const inner = document.getElementById('messagesInner');
  const div   = document.createElement('div');
  div.className = 'thinking';
  div.id        = 'thinking';
  div.innerHTML = `
    <div class="msg-avatar avatar-ai">AI</div>
    <div class="thinking-dots">
      <span></span><span></span><span></span>
    </div>`;
  inner.appendChild(div);
  scrollBottom();
}

function removeThinking() {
  const el = document.getElementById('thinking');
  if (el) el.remove();
}

function renderToolCall(tool) {
  const args = JSON.stringify(tool.input || {}, null, 0);
  const preview = args.length > 120 ? args.slice(0, 120) + '…' : args;
  return `
    <div class="tool-call">
      <div class="tool-call-icon">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
        </svg>
      </div>
      <div class="tool-call-body">
        <div class="tool-call-name">${escapeHtml(tool.name)}</div>
        <div class="tool-call-args">${escapeHtml(preview)}</div>
      </div>
    </div>`;
}

function appendAiMsg(text, toolCalls) {
  const inner = document.getElementById('messagesInner');
  const div   = document.createElement('div');
  div.className = 'msg-row';

  const toolHtml = (toolCalls || []).map(renderToolCall).join('');

  div.innerHTML = `
    <div class="msg-avatar avatar-ai">AI</div>
    <div class="msg-content">
      <div class="msg-name">Claude</div>
      <div class="msg-bubble bubble-ai">${formatMessage(text)}${toolHtml}</div>
    </div>`;
  inner.appendChild(div);
  scrollBottom();
}

// ─── API CALL ──────────────────────────────────────────────────────────────────
async function sendMessage() {
  if (isLoading) return;

  const field = document.getElementById('inputField');
  const text  = field.value.trim();
  if (!text) return;

  // Clear input
  field.value = '';
  field.style.height = 'auto';
  isLoading = true;
  document.getElementById('sendBtn').disabled = true;

  // Optimistic UI
  messages.push({ role: 'user', content: text });
  appendUserMsg(text);
  appendThinking();

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'mcp-client-2025-04-04'  // required for MCP
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages,
        mcp_servers: [
          { type: 'url', url: GMAIL_MCP_URL,  name: 'gmail-mcp' },
          { type: 'url', url: GCAL_MCP_URL,   name: 'gcal-mcp'  }
        ]
      })
    });

    const data = await response.json();
    removeThinking();

    if (data.error) {
      const errMsg = 'API error: ' + data.error.message;
      appendAiMsg(errMsg, null);
      messages.push({ role: 'assistant', content: errMsg });
      return;
    }

    // Extract text + tool calls from content blocks
    const textBlocks = (data.content || []).filter(b => b.type === 'text');
    const toolCalls  = (data.content || []).filter(b => b.type === 'mcp_tool_use');
    const replyText  = textBlocks.map(b => b.text).join('\n') || '(No response)';

    appendAiMsg(replyText, toolCalls);
    messages.push({ role: 'assistant', content: data.content || replyText });

  } catch (err) {
    removeThinking();
    const errMsg = 'Network error: ' + err.message;
    appendAiMsg(errMsg, null);
  } finally {
    isLoading = false;
    document.getElementById('sendBtn').disabled = false;
    field.focus();
  }
}