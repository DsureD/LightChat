import { getSessionUser } from "@/lib/auth";
import { jsonError, jsonOk, routeError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await getSessionUser();

    if (!user) {
      return jsonError("Unauthorized", 401);
    }

    const conversations = await prisma.conversation.findMany({
      orderBy: { updatedAt: "desc" },
      take: 80
    });

    return jsonOk({
      conversations: conversations.map((conversation) => ({
        id: conversation.id,
        title: conversation.title,
        providerId: conversation.providerId,
        modelId: conversation.modelId,
        modelName: conversation.modelName,
        createdAt: conversation.createdAt.toISOString(),
        updatedAt: conversation.updatedAt.toISOString()
      }))
    });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();

    if (!user) {
      return jsonError("Unauthorized", 401);
    }

    const body = await request.json();
    const title = String(body.title || "新会话").trim().slice(0, 80) || "新会话";
    const modelId = typeof body.modelId === "string" ? body.modelId : undefined;
    const model = modelId
      ? await prisma.model.findFirst({ where: { id: modelId }, include: { provider: true } })
      : null;

    const conversation = await prisma.conversation.create({
      data: {
        title,
        modelId: model?.id,
        modelName: model?.name,
        providerId: model?.providerId
      }
    });

    return jsonOk({
      conversation: {
        id: conversation.id,
        title: conversation.title,
        providerId: conversation.providerId,
        modelId: conversation.modelId,
        modelName: conversation.modelName,
        createdAt: conversation.createdAt.toISOString(),
        updatedAt: conversation.updatedAt.toISOString(),
        messages: []
      }
    });
  } catch (error) {
    return routeError(error);
  }
}
