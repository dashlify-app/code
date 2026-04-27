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
    console.log('[logAIUsage] Iniciando logging de IA...');
    console.log('[logAIUsage] userId:', data.userId);
    console.log('[logAIUsage] actionType:', data.actionType);
    console.log('[logAIUsage] tokens:', {
      prompt: data.usage.prompt_tokens,
      completion: data.usage.completion_tokens,
      total: data.usage.total_tokens
    });

    // Tarifas oficiales de GPT-4o (Mayo 2024)
    const promptCost = data.usage.prompt_tokens * 0.000005;
    const completionCost = data.usage.completion_tokens * 0.000015;
    const estimatedCostUSD = promptCost + completionCost;

    console.log('[logAIUsage] Costo calculado:', estimatedCostUSD);

    const payload = {
      userId: data.userId || null,
      actionType: data.actionType,
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
      totalTokens: data.usage.total_tokens,
      estimatedCostUSD,
      requestPayload: data.requestPayload || null,
      responsePayload: data.responsePayload || null,
      createdAt: new Date().toISOString(),
    };

    console.log('[logAIUsage] Payload a insertar:', JSON.stringify(payload, null, 2));

    // Usar .insert() sin .select() para evitar problemas con id auto-generated
    const { error, data: insertedData } = await supabaseAdmin
      .from('AILog')
      .insert([payload]);

    if (error) {
      console.error('[logAIUsage] ❌ Error en insert:', error);
      console.error('[logAIUsage] Error details:', {
        message: error.message,
        code: (error as any).code,
        details: (error as any).details,
        hint: (error as any).hint,
      });
      throw error;
    }

    console.log('[logAIUsage] ✅ Log guardado exitosamente en Supabase');
    console.log('[logAIUsage] Response data:', insertedData);
  } catch (error) {
    console.error('[logAIUsage] ❌ Error fatal al guardar log de IA en Supabase:', error);
    console.error('[logAIUsage] Error details:', {
      message: (error as any)?.message,
      code: (error as any)?.code,
      details: (error as any)?.details,
      hint: (error as any)?.hint,
    });
    // No relanzar el error - logging no debe romper la operación principal
  }
}
