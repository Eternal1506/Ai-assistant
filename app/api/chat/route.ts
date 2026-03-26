import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import {
  tools,
  read_emails,
  send_email,
  list_events,
  create_event,
} from "@/lib/tools";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are a helpful AI assistant with access to the user's Gmail and Google Calendar. 
You can read emails, send emails, list calendar events, and create calendar events.
Always confirm before sending emails or creating events. Be concise but friendly.
When displaying emails or events, format them clearly. Today's date is ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}.`;

type Message = { role: "user" | "assistant"; content: string };

async function runToolCall(
  toolName: string,
  toolInput: Record<string, unknown>,
  accessToken: string
) {
  switch (toolName) {
    case "read_emails":
      return await read_emails(accessToken, toolInput as Parameters<typeof read_emails>[1]);
    case "send_email":
      return await send_email(accessToken, toolInput as Parameters<typeof send_email>[1]);
    case "list_events":
      return await list_events(accessToken, toolInput as Parameters<typeof list_events>[1]);
    case "create_event":
      return await create_event(accessToken, toolInput as Parameters<typeof create_event>[1]);
    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { messages }: { messages: Message[] } = await req.json();
    const accessToken = session.accessToken as string;

    // Agentic loop
    const apiMessages: Anthropic.MessageParam[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    let response = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools,
      messages: apiMessages,
    });

    // Loop while Claude wants to use tools
    while (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
      );

      // Execute all tool calls
      const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
        toolUseBlocks.map(async (toolUse) => {
          const result = await runToolCall(
            toolUse.name,
            toolUse.input as Record<string, unknown>,
            accessToken
          );
          return {
            type: "tool_result" as const,
            tool_use_id: toolUse.id,
            content: JSON.stringify(result),
          };
        })
      );

      // Continue the conversation with tool results
      apiMessages.push({ role: "assistant", content: response.content });
      apiMessages.push({ role: "user", content: toolResults });

      response = await client.messages.create({
        model: "claude-opus-4-5",
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools,
        messages: apiMessages,
      });
    }

    const textContent = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    return NextResponse.json({ message: textContent });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}
