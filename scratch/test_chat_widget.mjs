
// fetch es nativo en Node 22
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

async function testChatWidget() {
  console.log('Probando /api/chat-widget...');
  
  // Nota: Esto fallará con 401 si no hay sesión, 
  // pero queremos ver si al menos el servidor responde o si cuelga.
  try {
    const res = await fetch('http://localhost:3000/api/chat-widget', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Hola',
        schema: ['id', 'name'],
        chatHistory: []
      })
    });
    
    console.log('Status:', res.status);
    const data = await res.json();
    console.log('Data:', data);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testChatWidget();
