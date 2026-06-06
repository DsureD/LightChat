import { requireAdmin } from "@/lib/auth";
import { capabilitiesForType, fetchProviderModels, inferModelType } from "@/lib/openai";
import { jsonOk, routeError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ providerId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    await requireAdmin();
    const { providerId } = await context.params;
    const provider = await prisma.provider.findUniqueOrThrow({ where: { id: providerId } });
    const modelNames = await fetchProviderModels(provider);

    const models = await Promise.all(
      modelNames.map(async (name) => {
        const type = inferModelType(name);

        return prisma.model.upsert({
          where: { providerId_name: { providerId, name } },
          create: {
            providerId,
            name,
            type,
            capabilities: capabilitiesForType(type),
            enabled: true
          },
          update: {}
        });
      })
    );

    return jsonOk({
      count: models.length,
      models: models.map((model) => ({
        id: model.id,
        providerId: model.providerId,
        name: model.name,
        type: model.type,
        capabilities: model.capabilities,
        enabled: model.enabled
      }))
    });
  } catch (error) {
    return routeError(error);
  }
}
