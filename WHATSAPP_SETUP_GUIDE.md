# 📱 **Guia Completo: WhatsApp Business API**

## 🎯 **Objetivo**
Configurar credenciais do WhatsApp Business para integração com o sistema de agendamentos.

## 📋 **Pré-requisitos**
- Conta Facebook/Meta válida
- Número de telefone business (não pode ser pessoal)
- Acesso ao Facebook Developers

---

## 🚀 **Passo 1: Criar App no Facebook Developers**

### 1.1 Acesse o Portal
```
https://developers.facebook.com/
```

### 1.2 Crie Novo App
1. Clique em **"Meus Apps"**
2. **"Criar App"**
3. Escolha **"Business"**
4. Nome do App: `WhatsApp Salão Bot`
5. Email de contato business

---

## 📞 **Passo 2: Configurar WhatsApp Business**

### 2.1 Adicionar Produto
1. No dashboard do app, procure **"WhatsApp"**
2. Clique em **"Configurar"**
3. Aceite os termos de uso

### 2.2 Configurar Número
1. Vá para **"API Setup"**
2. Adicione número de telefone business
3. Verifique via SMS
4. **ANOTE o Phone Number ID** 📝

### 2.3 Obter Access Token
1. Em **"API Setup"**
2. Copie o **"Temporary access token"**
3. Para produção, gere um **Permanent Token**
4. **ANOTE o Token** 📝

---

## 🔗 **Passo 3: Configurar Webhook**

### 3.1 URLs de Webhook
- **Desenvolvimento**: `https://xyz.ngrok.io/api/whatsapp/webhook`
- **Produção**: `https://seudominio.com/api/whatsapp/webhook`

### 3.2 Configurar no Facebook
1. Vá para **"Configuration" > "Webhooks"**
2. Clique **"Edit"**
3. **Callback URL**: Sua URL do webhook
4. **Verify Token**: (você escolhe, ex: `meu_webhook_2024`)
5. **Subscribe to**: `messages`

---

## ⚙️ **Passo 4: Executar Configuração**

Execute o script de configuração:

```bash
node setup-whatsapp.js
```

Você precisará fornecer:
- 🔑 **Access Token** (do Facebook Developers)
- 📞 **Phone Number ID** (do Facebook Developers)  
- 🔒 **Webhook Verify Token** (você escolhe)
- 🛡️ **Webhook Secret** (você escolhe)

---

## 🧪 **Passo 5: Testar Configuração**

### 5.1 Testar Credenciais
```bash
node test-whatsapp-credentials.js
```

### 5.2 Testar Webhook (Desenvolvimento)
```bash
# Instalar ngrok (se não tiver)
npm install -g ngrok

# Expor porta local
ngrok http 3000

# Usar URL HTTPS do ngrok no Facebook
```

---

## 🚨 **Problemas Comuns**

### ❌ **Token Inválido**
- Verifique se copiou token completo
- Token temporário expira em 24h
- Gere token permanente para produção

### ❌ **Webhook Fail**
- URL deve ser HTTPS
- Verify Token deve corresponder
- Webhook deve responder status 200

### ❌ **Número Não Verificado**
- Use número business válido
- Complete verificação SMS
- Aguarde aprovação Meta (pode demorar)

---

## 📚 **Documentação Oficial**
- [WhatsApp Business API](https://developers.facebook.com/docs/whatsapp)
- [Getting Started](https://developers.facebook.com/docs/whatsapp/getting-started)
- [Webhook Setup](https://developers.facebook.com/docs/whatsapp/webhooks)

---

## 🎉 **Próximos Passos**
Após configurar credenciais:
1. ✅ Testar envio de mensagens
2. ✅ Configurar IA do sistema
3. ✅ Deploy em produção
4. ✅ Solicitar aprovação business Meta 