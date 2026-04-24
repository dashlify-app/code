import prisma from '@/lib/prisma';

interface UsageStats {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface LogData {
  userId?: string;
  actionType: string;
  usage: UsageStats;
  requestPayload?: any;
  responsePayload?: any;
}

export async function logAIUsage(data: LogData) {
  try {
    // Tarifas oficiales de GPT-4o (Mayo 2024)
    // $5.00 por 1M tokens de entrada -> 0.000005 por token
    // $15.00 por 1M tokens de salida -> 0.000015 por token
    const promptCost = data.usage.prompt_tokens * 0.000005;
    const completionCost = data.usage.completion_tokens * 0.000015;
    const estimatedCostUSD = promptCost + completionCost;

    await prisma.aILog.create({
      data: {
        userId: data.userId,
        actionType: data.actionType,
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
        estimatedCostUSD,
        requestPayload: data.requestPayload || undefined,
        responsePayload: data.responsePayload || undefined,
      }
    });
  } catch (error) {
    console.error('Error al guardar log de IA:', error);
    // No lanzamos el error para no interrumpir el flujo principal del usuario
  }
}
