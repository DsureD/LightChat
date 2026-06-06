import { getSessionUser } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { getProviderHeaders, providerUrl, type ChatMessage } from "@/lib/openai";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function streamEvent(eventName: string, data: unknown) {
  return `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
}

function conversationTitle(content: string) {
  return content.replace(/\s+/g, " ").trim().slice(0, 30) || "新会话";
}

function extractDelta(payload: unknown) {
  const choice = (payload as { choices?: Array<{ delta?: { content?: string }; text?: string }> })?.choices?.[0];
  return choice?.delta?.content ?? choice?.text ?? "";
}

async function buildContextMessages(conversationId: string): Promise<ChatMessage[]> {
  const messages = await prisma.message.findMany({
    where: {
      conversationId,
      role: { in: ["system", "user", "assistant"] }
    },
    orderBy: { createdAt: "desc" },
    take: 24
  });

  return messages.reverse().map((message) => ({
    role: message.role as ChatMessage["role"],
    content: message.content
  }));
}

export async function POST(request: Request) {
  const user = await getSessionUser();

  if (!user) {
    return jsonError("Unauthorized", 401);
  }

  const body = await request.json();
  const modelId = String(body.modelId || "");
  const content = String(body.content || "").trim();

  if (!modelId || !content) {
    return jsonError("模型和消息内容不能为空。", 400);
  }

  const model = await prisma.model.findFirst({
    where: { id: modelId, enabled: true, provider: { enabled: true } },
    include: { provider: true }
  });

  if (!model) {
    return jsonError("模型不存在或未启用。", 404);
  }

  if (model.type === "image") {
    return jsonError("图片模型请使用图片生成接口。", 400);
  }

  const existingConversationId = typeof body.conversationId === "string" ? body.conversationId : "";
  const conversation = existingConversationId
    ? await prisma.conversation.update({
        where: { id: existingConversationId },
        data: { modelId: model.id, modelName: model.name, providerId: model.providerId }
      })
    : await prisma.conversation.create({
        data: {
          title: conversationTitle(content),
          modelId: model.id,
          modelName: model.name,
          providerId: model.providerId
        }
      });

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: "user",
      content,
      modelName: model.name
    }
  });

  const contextMessages = await buildContextMessages(conversation.id);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (eventName: string, data: unknown) => controller.enqueue(encoder.encode(streamEvent(eventName, data)));

      send("meta", {
        conversationId: conversation.id,
        title: conversation.title,
        modelName: model.name
      });

      let assistantContent = "";

      try {
        const response = await fetch(providerUrl(model.provider, "/v1/chat/completions"), {
          method: "POST",
          headers: getProviderHeaders(model.provider),
          body: JSON.stringify({
            model: model.name,
            messages: contextMessages,
            temperature: Number(body.temperature ?? 0.7),
            stream: true
          })
        });

        if (!response.ok || !response.body) {
          send("error", { message: `模型调用失败：${response.status} ${await response.text()}` });
          controller.close();
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let done = false;

        while (!done) {
          const result = await reader.read();
          done = result.done;
          buffer += decoder.decode(result.value ?? new Uint8Array(), { stream: !done });

          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const rawLine of lines) {
            const line = rawLine.trim();

            if (!line.startsWith("data:")) {
              continue;
            }

            const data = line.slice(5).trim();

            if (!data || data === "[DONE]") {
              continue;
            }

            try {
              const delta = extractDelta(JSON.parse(data));

              if (delta) {
                assistantContent += delta;
                send("delta", { content: delta });
              }
            } catch {
              send("delta", { content: data });
              assistantContent += data;
            }
          }
        }

        const assistantMessage = await prisma.message.create({
          data: {
            conversationId: conversation.id,
            role: "assistant",
            content: assistantContent,
            modelName: model.name
          }
        });

        send("done", {
          messageId: assistantMessage.id,
          conversationId: conversation.id,
          content: assistantContent
        });
      } catch (error) {
        send("error", { message: error instanceof Error ? error.message : "模型调用异常。" });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}
