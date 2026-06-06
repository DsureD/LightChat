import { getSessionUser } from "@/lib/auth";
import { jsonError, jsonOk, routeError } from "@/lib/http";
import { getProviderHeaders, providerUrl } from "@/lib/openai";
import { prisma } from "@/lib/prisma";

function conversationTitle(content: string) {
  return `画图：${content.replace(/\s+/g, " ").trim().slice(0, 24) || "新图片"}`;
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();

    if (!user) {
      return jsonError("Unauthorized", 401);
    }

    const body = await request.json();
    const modelId = String(body.modelId || "");
    const prompt = String(body.prompt || body.content || "").trim();

    if (!modelId || !prompt) {
      return jsonError("模型和提示词不能为空。", 400);
    }

    const model = await prisma.model.findFirst({
      where: { id: modelId, enabled: true, provider: { enabled: true } },
      include: { provider: true }
    });

    if (!model) {
      return jsonError("模型不存在或未启用。", 404);
    }

    if (model.type !== "image" && !model.capabilities.split(",").includes("image")) {
      return jsonError("当前模型未标记为图片模型。", 400);
    }

    const conversationId = typeof body.conversationId === "string" ? body.conversationId : "";
    const conversation = conversationId
      ? await prisma.conversation.update({
          where: { id: conversationId },
          data: { modelId: model.id, modelName: model.name, providerId: model.providerId }
        })
      : await prisma.conversation.create({
          data: {
            title: conversationTitle(prompt),
            modelId: model.id,
            modelName: model.name,
            providerId: model.providerId
          }
        });

    const userMessage = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "user",
        content: prompt,
        modelName: model.name
      }
    });

    const response = await fetch(providerUrl(model.provider, "/v1/images/generations"), {
      method: "POST",
      headers: getProviderHeaders(model.provider),
      body: JSON.stringify({
        model: model.name,
        prompt,
        n: Number(body.n ?? 1),
        size: String(body.size || "1024x1024"),
        response_format: String(body.responseFormat || "url")
      })
    });

    if (!response.ok) {
      return jsonError(`图片生成失败：${response.status} ${await response.text()}`, response.status);
    }

    const payload = await response.json();
    const firstImage = Array.isArray(payload?.data) ? payload.data[0] : payload;
    const imageUrl = typeof firstImage?.url === "string" ? firstImage.url : null;
    const imageBase64 = typeof firstImage?.b64_json === "string" ? firstImage.b64_json : null;
    const revisedPrompt = typeof firstImage?.revised_prompt === "string" ? firstImage.revised_prompt : null;

    if (!imageUrl && !imageBase64) {
      return jsonError("图片接口未返回 url 或 b64_json。", 502);
    }

    const assistantMessage = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "assistant",
        content: revisedPrompt || "图片已生成。",
        modelName: model.name,
        imageUrl,
        imageBase64,
        metadata: JSON.stringify(payload)
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
        updatedAt: conversation.updatedAt.toISOString()
      },
      messages: [
        {
          id: userMessage.id,
          role: userMessage.role,
          content: userMessage.content,
          modelName: userMessage.modelName,
          imageUrl: userMessage.imageUrl,
          imageBase64: userMessage.imageBase64,
          createdAt: userMessage.createdAt.toISOString()
        },
        {
          id: assistantMessage.id,
          role: assistantMessage.role,
          content: assistantMessage.content,
          modelName: assistantMessage.modelName,
          imageUrl: assistantMessage.imageUrl,
          imageBase64: assistantMessage.imageBase64,
          createdAt: assistantMessage.createdAt.toISOString()
        }
      ]
    });
  } catch (error) {
    return routeError(error);
  }
}
