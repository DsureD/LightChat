import { getSessionUser } from "@/lib/auth";
import { jsonError, jsonOk, routeError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ conversationId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await getSessionUser();

    if (!user) {
      return jsonError("Unauthorized", 401);
    }

    const { conversationId } = await context.params;
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { messages: { orderBy: { createdAt: "asc" } } }
    });

    if (!conversation) {
      return jsonError("会话不存在。", 404);
    }

    return jsonOk({
      conversation: {
        id: conversation.id,
        title: conversation.title,
        providerId: conversation.providerId,
        modelId: conversation.modelId,
        modelName: conversation.modelName,
        createdAt: conversation.createdAt.toISOString(),
        updatedAt: conversation.updatedAt.toISOString(),
        messages: conversation.messages.map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
          modelName: message.modelName,
          imageUrl: message.imageUrl,
          imageBase64: message.imageBase64,
          createdAt: message.createdAt.toISOString()
        }))
      }
    });
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await getSessionUser();

    if (!user) {
      return jsonError("Unauthorized", 401);
    }

    const { conversationId } = await context.params;
    const body = await request.json();
    const title = String(body.title || "").trim().slice(0, 80);

    if (!title) {
      return jsonError("会话标题不能为空。", 400);
    }

    const conversation = await prisma.conversation.update({
      where: { id: conversationId },
      data: { title }
    });

    return jsonOk({
      conversation: {
        id: conversation.id,
        title: conversation.title,
        providerId: conversation.providerId,
        modelId: conversation.modelId,
        modelName: conversation.modelName,
        createdAt: conversation.createdAt.toISOString(),
        updatedAt: conversation.updatedAt.toISOString()
      }
    });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await getSessionUser();

    if (!user) {
      return jsonError("Unauthorized", 401);
    }

    const { conversationId } = await context.params;
    await prisma.conversation.delete({ where: { id: conversationId } });
    return jsonOk({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}
