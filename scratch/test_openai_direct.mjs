
import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function testOpenAI() {
  try {
    console.log('Probando OpenAI API Key...');
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Di "Conectado"' }],
    });
    console.log('Respuesta de OpenAI:', response.choices[0].message.content);
    console.log('✅ OpenAI está conectado.');
  } catch (error) {
    console.error('❌ Error al conectar con OpenAI:', error.message);
  }
}

testOpenAI();
