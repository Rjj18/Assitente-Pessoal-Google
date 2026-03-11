# 🎙️ Agente Voz - Assistente Pessoal Inteligente

Sistema inteligente de processamento de notas por voz e texto, com integração a Google Apps Script, Telegram, Gemini API, Google Drive, Google Tasks, Google Calendar e Obsidian.

## 🎯 Visão Geral

O **Agente Voz** é um bot de Telegram que:
1. **Captura notas por voz ou texto** via Telegram
2. **Processa com IA (Gemini)** para estructura e limpeza
3. **Distribui para múltiplos serviços**:
   - 📝 Google Drive (notas estruturadas em Markdown para Obsidian)
   - ✅ Google Tasks (com extração automática de tarefas)
   - 📅 Google Calendar (com extração automática de eventos)
   - 🔖 Tags inteligentes (sugeridas por IA)

## 📋 Arquitetura

```
┌─────────────────┐
│   Telegram Bot  │ (webhook)
└────────┬────────┘
         │
    ┌────▼────┐
    │  GAS    │ (Google Apps Script)
    │ Código  │ (Webhook Handler)
    └────┬────┘
         │
    ┌────▼────────────────┐
    │  Processamento      │
    ├────────────────────┤
    │ • Cérebro (prompt) │ ← IA structuring
    │ • Organizador      │ ← Distribuição
    │ • Scanner          │ ← Batch processing
    └────┬───────────────┘
         │
    ┌────▼──────────────────────────┐
    │   Destinos de Sincronização   │
    ├───────────────────────────────┤
    │ • Google Drive (Markdown)     │
    │ • Google Tasks                │
    │ • Google Calendar             │
    │ • Obsidian (via Drive Sync)   │
    └───────────────────────────────┘
```

## 🚀 Quick Start

### 1. Pré-requisitos
- Node.js + npm (para `clasp`)
- Conta Google com Google Apps Script habilitado
- Conta Telegram Bot (via BotFather)
- Chave API do Google Generative AI (Gemini)

### 2. Setup Inicial

**Clone e configure o ambiente:**
```bash
git clone <repo>
cd app_assistente/Agente_Voz_Roger
```

**Instale clasp globalmente:**
```bash
npm install -g @google/clasp
clasp login  # Autorize com sua conta Google
```

**Configure as variáveis de ambiente:**

No Google Apps Script, acesse **Menu: Projeto > Propriedades do Script** e adicione:

```
GEMINI_API_KEY=seu-api-key-aqui
TELEGRAM_TOKEN=seu-token-telegram-aqui
TELEGRAM_ADMIN_CHAT_ID=seu-chat-id-aqui
FOLDER_ID=id-da-pasta-drive-para-notas-brutas
PROCESSED_FOLDER_ID=id-da-pasta-de-processados
GENERAL_NOTES_FOLDER_ID=id-da-pasta-geral-de-notas
WEBHOOK_URL=https://script.google.com/macros/d/{SCRIPT_ID}/usercontent/doPost
MODELO_IA=gemini-2.5-flash
GEMINI_MIN_INTERVAL_MS=3000
MAX_ARQUIVOS_POR_BATCH=10
PROCESSAMENTO_DIARIO_HORA=7
PROCESSAMENTO_DIARIO_MINUTO=15
```

**Obtenha os IDs do Google Drive:**
```javascript
// Execute no console do Google Apps Script > Editor:
function obterIDs() {
  Logger.log("ID da pasta raiz: " + DriveApp.getRootFolder().getId());
  
  // Para pastas específicas, clique com botão direito > Compartilhar > copie da URL
  // URL: https://drive.google.com/drive/folders/{FOLDER_ID}
}
```

**Configure o webhook do Telegram:**
```javascript
// Execute uma vez no Google Apps Script para registrar o webhook:
function configurarWebhook() {
  const config = getConfig_();
  const url = `https://api.telegram.org/bot${config.TELEGRAM_TOKEN}/setWebhook`;
  
  const payload = {
    url: config.WEBHOOK_URL,
    drop_pending_updates: true
  };
  
  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload)
  };
  
  const response = UrlFetchApp.fetch(url, options);
  Logger.log("Webhook configurado: " + response.getContentText());
}
```

### 3. Deploy

```bash
clasp push        # Push do código local para GAS
clasp open        # Abre o projeto no navegador
```

## 📱 Como Usar

### Comandos Telegram

**📝 Enviar nota de voz ou texto:**
```
Apenas clique em 🎤 para enviar áudio
OU digitáe uma mensagem e envie
```

**⚙️ Ver/Trocar modelo IA:**
```
/modelo                    # Mostra modelo atual
/modelo gemini-2.5-pro    # Troca para outro modelo
```

**🔄 Processar lote de arquivos:**
```
/processar   # Processa até 10 arquivos não processados (configurável)
```

### Resultado no Obsidian

As notas processadas aparecem no Drive em arquivos Markdown categoria:

```markdown
# Ideias

---
## [2026-03-10 14:23]

### Melhorar o sistema de tags

Implementar sistema de categorização automática visual em Markdown, com suporte a múltiplas dimensões (prioridade, status, tipo).

**Tags:** #sistema #obsidian #automação

### Novo framework de dados

Consideração sobre integração de novo sistema de persistência que seja mais eficiente.

**Tags:** #tech #framework #backend
```

Com **Obsidian** sincronizado via Google Drive, as tags aparecem no grafo e ficam automaticamente indexadas! 🎉

## 🏗️ Estrutura do Código

### `Código.js` (~630 linhas)
- **Webhook Handler**: Processa requisições do Telegram
- **Processadores**: `processarMensagemAudio_()`, `processarMensagemTexto_()`
- **Gemini Integration**: Chamar IA para processar conteúdo
- **Telegram API**: Enviar/receber mensagens
- **Google Drive**: Salvar notas brutas
- **Tratamento de Rate Limit** com retry automático

### `Organizador.js` (~560 linhas)
- **Distribuidor**: Envia dados para Tasks, Calendar, Drive
- **Parser de Datas**: Extrai datas inteligentemente com IA
- **Google Calendar**: Cria eventos com datas extraídas
- **Google Tasks**: Cria tarefas com contexto
- **Salvamento de Notas**: Agrega por categoria com tags

### `Cerebro.gs.js` (~100 linhas)
- **Prompt do Gemini**: Instrução para estruturação de dados
- **Schema JSON**: Define estrutura esperada de retorno

### `Scanner.gs.js` (~35 linhas)
- **Listagem de arquivos**: Encontra novos Markdown não processados
- **Batch processing**: Processa em lotes configuráveis

## ⚙️ Configuração Avançada

### Ajustar Frequência de Processamento

**Para processar 1x ao dia automaticamente:**
```javascript
// Execute uma vez:
configurarTriggersAutomaticos();

// Para visualizar triggers:
listarTriggersProcessamento();
```

### Mudar Modelo IA em Tempo Real

Via Telegram:
```
/modelo gemini-2.5-pro    # Muda para gemini pro
```

Ou no Script Properties for modelos permitidos:
```
MODELOS_PERMITIDOS: gemini-2.5-pro,gemini-2.5-flash,gemini-2.0-flash
```

### Aumentar Limite de Batch

No Script Properties:
```
MAX_ARQUIVOS_POR_BATCH=50    # Processa até 50 arquivos por vez
```

### Configurar Taxa de Rate Limit

No Script Properties:
```
GEMINI_MIN_INTERVAL_MS=5000   # Aguarda 5s entre requisições (padrão 3s)
```

## 🔒 Segurança

### ⚠️ IMPORTANTE: Proteger Credenciais

**NUNCA** fazer push de `.clasprc.json` e `.clasp.json`! 

Esses arquivos contêm:
- `scriptId` (ID único do projeto GAS) 
- Tokens de autenticação

**Verificar se está no `.gitignore`:**
```bash
cat .gitignore | grep clasp
# Deve retornar: .clasprc.json e .clasp.json
```

**Se já foi feito push acidentalmente:**
```bash
git rm --cached .clasprc.json .clasp.json
git commit -m "Remove sensitive clasp files"
git push
```

### Boas Práticas

1. ✅ Use **Script Properties** para credenciais (não no código)
2. ✅ Valide **todas as entradas** de webhook
3. ✅ Implemente **rate limiting** para APIs
4. ✅ Log detalhadade **erros** para debug
5. ✅ Use **timeouts** em chamadas HTTP
6. ✅ Sanitize **nomes de arquivo** antes de criar no Drive

## 🐛 Troubleshooting

### "❌ Não foi possível processar"

**Causas comuns:**
1. API Gemini sem saldo / quota excedida
2. Pastas do Drive com IDs inválidos
3. Áudio corrompido ou muito pesado

**Debug:**
```javascript
// Execute no console GAS:
Logger.log(getConfig_());  // Verifica todas as variáveis
listarTriggersProcessamento();  // Verifica triggers
testarIntegracaoComIA();  // Testa fluxo completo
```

### "⚠️ Rate limit do Gemini"

Aumentar intervalo entre requisições:
```
GEMINI_MIN_INTERVAL_MS=10000  # Espera 10s
```

Ou trocar modelo para menos pesado:
```
/modelo gemini-2.5-flash   # Mais rápido e barato
```

### Notas não aparecem no Obsidian

1. Verificar se Drive está sincronizado localmente
2. Confirmar `GENERAL_NOTES_FOLDER_ID` está correto
3. Rodar `/processar` manualmente para ver erros

## 📊 Limites Conhecidos

| Limite | Valor | Nota |
|--------|-------|------|
| Tamanho de áudio | 20 MB | Telegram limit |
| Tamanho de mensagem Telegram | 4096 chars | Truncado automaticamente |
| Requisições Gemini/min | Conforme plano | Rate limit handling |
| Arquivos/batch | 10 (configurável) | Evita timeout |
| Timeout HTTP | 30-60s | Para diferentes calls |

## 📚 API Reference

### Funções Públicas

```javascript
// Distribui dados estruturados para serviços
distribuirDadosExtraidos(dadosEstruturados, arquivoId)

// Processa lote de arquivos Markdown
processarArquivosMarkdown()

// Configura trigger diário automático
configurarTriggersAutomaticos()

// Lista triggers ativos
listarTriggersProcessamento()

// Lista modelos Gemini disponíveis
listarModelosDisponiveis()

// Testa suporte de áudio em modelo
testarSuporteAudio(nomeModelo)

// Testa integração completa
testarIntegracaoComIA()
```

## 🚀 Deploy com Docker

Opcionalmente, pode rodar ambiente de desenvolvimento em Docker:

```bash
docker-compose up -d              # Inicia container
docker exec -it workspace-gas sh  # Entra no container

# Dentro do container:
cd /workspace/Agente_Voz_Roger
clasp pull   # Puxa código do GAS
clasp push   # Sobe código para GAS
```

## 📝 Changelog

### v1.1.0 (Março 2026)
- ✅ Tags sugeridas por IA em notas
- ✅ Melhor tratamento de timeouts
- ✅ Validação de entrada robusta
- ✅ Rate limiting aprimorado

### v1.0.0 (Inicial)
- 🎙️ Processamento de áudio e texto
- 📅 Integração com Calendar e Tasks
- 🔖 Tags automáticas
- 🎯 Batch processing com triggers

## 🤝 Contribuindo

1. Clone o repo
2. Crie uma branch para sua feature
3. Faça push e abra um Pull Request

## 📄 Licença

MIT License - veja LICENSE para detalhes
