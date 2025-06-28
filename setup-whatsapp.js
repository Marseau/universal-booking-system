#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🚀 CONFIGURADOR WHATSAPP BUSINESS API');
console.log('=====================================\n');

async function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function setupWhatsApp() {
  try {
    console.log('📋 Você precisará das seguintes informações do Facebook Developers:\n');
    console.log('1. 🔑 Access Token (Permanent Token)');
    console.log('2. 📞 Phone Number ID');
    console.log('3. 🔒 Webhook Verify Token (você escolhe)');
    console.log('4. 🛡️ Webhook Secret (você escolhe)\n');
    
    console.log('💡 DICA: Acesse https://developers.facebook.com/apps\n');
    
    // Collect credentials
    const token = await askQuestion('🔑 Cole seu WhatsApp Access Token: ');
    const phoneId = await askQuestion('📞 Cole seu Phone Number ID: ');
    const verifyToken = await askQuestion('🔒 Defina um Webhook Verify Token (ex: meu_webhook_2024): ') || 'universal_booking_webhook_2024';
    const webhookSecret = await askQuestion('🛡️ Defina um Webhook Secret (ex: meu_secret_123): ') || 'webhook_secret_universal_booking_2024';
    
    // Read current .env
    const envPath = path.join(__dirname, '.env');
    let envContent = '';
    
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    // Update WhatsApp credentials
    envContent = envContent
      .replace(/WHATSAPP_TOKEN=.*/, `WHATSAPP_TOKEN=${token}`)
      .replace(/WHATSAPP_PHONE_NUMBER_ID=.*/, `WHATSAPP_PHONE_NUMBER_ID=${phoneId}`)
      .replace(/WHATSAPP_WEBHOOK_VERIFY_TOKEN=.*/, `WHATSAPP_WEBHOOK_VERIFY_TOKEN=${verifyToken}`)
      .replace(/WHATSAPP_WEBHOOK_SECRET=.*/, `WHATSAPP_WEBHOOK_SECRET=${webhookSecret}`);
    
    // Write updated .env
    fs.writeFileSync(envPath, envContent);
    
    console.log('\n✅ Credenciais configuradas com sucesso!');
    console.log('\n📝 PRÓXIMOS PASSOS:');
    console.log('1. Configure o Webhook URL no Facebook Developers:');
    console.log(`   URL: https://seu-dominio.com/api/whatsapp/webhook`);
    console.log(`   Verify Token: ${verifyToken}`);
    console.log('\n2. Para desenvolvimento local, use ngrok:');
    console.log('   npm install -g ngrok');
    console.log('   ngrok http 3000');
    console.log('   Use a URL HTTPS que o ngrok fornecer\n');
    
    // Generate test script
    const testScript = `#!/usr/bin/env node

// TESTE DAS CREDENCIAIS WHATSAPP
const axios = require('axios');

const token = '${token}';
const phoneId = '${phoneId}';

async function testWhatsApp() {
  try {
    console.log('🧪 Testando credenciais WhatsApp...');
    
    const response = await axios.get(
      \`https://graph.facebook.com/v18.0/\${phoneId}\`,
      {
        headers: {
          'Authorization': \`Bearer \${token}\`
        }
      }
    );
    
    console.log('✅ Credenciais válidas!');
    console.log('📞 Número configurado:', response.data.display_phone_number);
    console.log('🆔 ID:', response.data.id);
    
  } catch (error) {
    console.error('❌ Erro ao testar credenciais:');
    console.error(error.response?.data || error.message);
  }
}

testWhatsApp();
`;
    
    fs.writeFileSync(path.join(__dirname, 'test-whatsapp-credentials.js'), testScript, { mode: 0o755 });
    
    console.log('3. Teste suas credenciais:');
    console.log('   node test-whatsapp-credentials.js\n');
    
  } catch (error) {
    console.error('❌ Erro durante configuração:', error);
  } finally {
    rl.close();
  }
}

setupWhatsApp(); 