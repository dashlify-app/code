import { supabaseAdmin } from '@/lib/supabase';

const WINDOW_MS = 60 * 1000; // 1 minuto
const MAX_PER_MINUTE = 10;

export async function checkRateLimit(userId: string, action: string): Promise<boolean> {
  try {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - WINDOW_MS);

    const { count, error } = await supabaseAdmin
      .from('ApiLog')
      .select('*', { count: 'exact', head: true })
      .eq('userId', userId)
      .eq('action', action)
      .gte('createdAt', oneMinuteAgo.toISOString());

    if (error) {
      console.error('Error checking rate limit:', error);
      return true; // Si hay error en la BD, permitir la llamada (fail open)
    }

    return (count || 0) < MAX_PER_MINUTE;
  } catch (error) {
    console.error('Error checking rate limit:', error);
    return true; // Si hay error, permitir la llamada (fail open)
  }
}

export async function logApiCall(userId: string, action: string): Promise<void> {
  try {
    await supabaseAdmin
      .from('ApiLog')
      .insert({
        userId,
        action,
        createdAt: new Date().toISOString(),
      });
  } catch (error) {
    console.error('Error logging API call:', error);
    // No re-throw: logging no debe impedir la ejecución
  }
}
