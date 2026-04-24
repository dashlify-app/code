import { supabaseAdmin } from '@/lib/supabase';

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
    const promptCost = data.usage.prompt_tokens * 0.000005;
    const completionCost = data.usage.completion_tokens * 0.000015;
    const estimatedCostUSD = promptCost + completionCost;

    const { error } = await supabaseAdmin
      .from('AILog')
      .insert({
        userId: data.userId || null,
        actionType: data.actionType,
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
        estimatedCostUSD,
        requestPayload: data.requestPayload || null,
        responsePayload: data.responsePayload || null,
      });

    if (error) throw error;
  } catch (error) {
    console.error('Error al guardar log de IA en Supabase:', error);
  }
}
