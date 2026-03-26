import { google } from "googleapis";

export function getGoogleClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return auth;
}

// ─── Tool Definitions for Claude ──────────────────────────────────────────────

export const tools = [
  {
    name: "read_emails",
    description:
      "Read recent emails from Gmail inbox. Returns subject, sender, date, snippet, and message ID.",
    input_schema: {
      type: "object" as const,
      properties: {
        maxResults: {
          type: "number",
          description: "Max number of emails to return (default: 5, max: 20)",
        },
        query: {
          type: "string",
          description:
            'Optional Gmail search query (e.g. "from:boss@company.com", "is:unread", "subject:meeting")',
        },
      },
      required: [],
    },
  },
  {
    name: "send_email",
    description: "Send an email via Gmail.",
    input_schema: {
      type: "object" as const,
      properties: {
        to: { type: "string", description: "Recipient email address" },
        subject: { type: "string", description: "Email subject" },
        body: { type: "string", description: "Plain text email body" },
      },
      required: ["to", "subject", "body"],
    },
  },
  {
    name: "list_events",
    description:
      "List upcoming Google Calendar events. Returns title, start time, end time, and location.",
    input_schema: {
      type: "object" as const,
      properties: {
        maxResults: {
          type: "number",
          description: "Max number of events to return (default: 5)",
        },
        timeMin: {
          type: "string",
          description:
            "Start time in ISO 8601 format (defaults to now if omitted)",
        },
        timeMax: {
          type: "string",
          description: "End time in ISO 8601 format (optional)",
        },
      },
      required: [],
    },
  },
  {
    name: "create_event",
    description: "Create a new Google Calendar event.",
    input_schema: {
      type: "object" as const,
      properties: {
        summary: { type: "string", description: "Event title" },
        description: { type: "string", description: "Event description" },
        startDateTime: {
          type: "string",
          description: "Start time in ISO 8601 format (e.g. 2024-06-10T14:00:00)",
        },
        endDateTime: {
          type: "string",
          description: "End time in ISO 8601 format",
        },
        attendees: {
          type: "array",
          items: { type: "string" },
          description: "List of attendee email addresses",
        },
        location: { type: "string", description: "Event location (optional)" },
      },
      required: ["summary", "startDateTime", "endDateTime"],
    },
  },
];

// ─── Tool Implementations ──────────────────────────────────────────────────────

export async function read_emails(
  accessToken: string,
  { maxResults = 5, query = "" }: { maxResults?: number; query?: string }
) {
  const auth = getGoogleClient(accessToken);
  const gmail = google.gmail({ version: "v1", auth });

  const listRes = await gmail.users.messages.list({
    userId: "me",
    maxResults: Math.min(maxResults, 20),
    q: query || "in:inbox",
  });

  const messages = listRes.data.messages ?? [];
  if (messages.length === 0) return { emails: [] };

  const emails = await Promise.all(
    messages.map(async (msg) => {
      const detail = await gmail.users.messages.get({
        userId: "me",
        id: msg.id!,
        format: "metadata",
        metadataHeaders: ["From", "Subject", "Date"],
      });
      const headers = detail.data.payload?.headers ?? [];
      const get = (name: string) =>
        headers.find((h) => h.name === name)?.value ?? "";
      return {
        id: msg.id,
        from: get("From"),
        subject: get("Subject"),
        date: get("Date"),
        snippet: detail.data.snippet ?? "",
      };
    })
  );

  return { emails };
}

export async function send_email(
  accessToken: string,
  {
    to,
    subject,
    body,
  }: { to: string; subject: string; body: string }
) {
  const auth = getGoogleClient(accessToken);
  const gmail = google.gmail({ version: "v1", auth });

  const raw = Buffer.from(
    `To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}`
  )
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
  return { success: true, message: `Email sent to ${to}` };
}

export async function list_events(
  accessToken: string,
  {
    maxResults = 5,
    timeMin,
    timeMax,
  }: { maxResults?: number; timeMin?: string; timeMax?: string }
) {
  const auth = getGoogleClient(accessToken);
  const calendar = google.calendar({ version: "v3", auth });

  const params: Parameters<typeof calendar.events.list>[0] = {
    calendarId: "primary",
    timeMin: timeMin ?? new Date().toISOString(),
    maxResults: Math.min(maxResults, 20),
    singleEvents: true,
    orderBy: "startTime",
  };
  if (timeMax) params.timeMax = timeMax;

  const res = await calendar.events.list(params);

  const events = (res.data.items ?? []).map((e) => ({
    id: e.id,
    summary: e.summary ?? "(No title)",
    start: e.start?.dateTime ?? e.start?.date,
    end: e.end?.dateTime ?? e.end?.date,
    location: e.location ?? "",
    description: e.description ?? "",
  }));

  return { events };
}

export async function create_event(
  accessToken: string,
  {
    summary,
    description,
    startDateTime,
    endDateTime,
    attendees = [],
    location,
  }: {
    summary: string;
    description?: string;
    startDateTime: string;
    endDateTime: string;
    attendees?: string[];
    location?: string;
  }
) {
  const auth = getGoogleClient(accessToken);
  const calendar = google.calendar({ version: "v3", auth });

  const res = await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary,
      description,
      location,
      start: { dateTime: startDateTime },
      end: { dateTime: endDateTime },
      attendees: attendees.map((email) => ({ email })),
    },
  });

  return {
    success: true,
    eventId: res.data.id,
    link: res.data.htmlLink,
    message: `Event "${summary}" created successfully.`,
  };
}