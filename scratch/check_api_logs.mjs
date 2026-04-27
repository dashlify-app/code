
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabase = createClient(process.env.PROJECT_URL_SUPABASE, process.env.SERVICE_ROLE_SUPABASE);

async function checkApiLogs() {
  const { data, error } = await supabase
    .from('ApiLog')
    .select('*')
    .order('createdAt', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Últimos 10 logs de ApiLog:');
    console.table(data);
  }
}

checkApiLogs();
