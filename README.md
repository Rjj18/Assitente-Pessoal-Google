# 🎙️ Assistente Pessoal Google

Um assistente inteligente baseado em Google Apps Script que processa notas de voz via Telegram, enriquece com IA (Gemini) e organiza automaticamente no Google Drive.

Transforme seus pensamentos diretos em notas estruturadas, tarefas e eventos — tudo sem tirar a mão do bolso.

---

## ✨ O que faz

- **📱 Recebe voz e texto pelo Telegram** — Envie notas de voz ou mensagens de texto diretamente para o bot
- **🧠 Processa com Gemini** — Transcreve áudio, estrutura texto e formata tudo em Markdown
- **📊 Extrai dados estruturados** — Identifica automaticamente tarefas, notas e eventos
- **💾 Salva no Drive/Obsidian** — Organiza tudo em uma pasta de seu Google Drive
- **⚙️ Configurável** — Ajuste prompts para qualquer tipo de assistente

---

## 🚀 Começando

### Pré-requisitos

- Conta Google com Google Drive e Google Apps Script habilitados
- Bot do Telegram criado (via [@BotFather](https://t.me/botfather))
- API key do Google Gemini
- Pasta no Google Drive para armazenar as notas

### 1. Clonar e Configurar o Projeto

```bash
git clone https://github.com/Rjj18/Assitente-Pessoal-Google.git
cd Assitente-Pessoal-Google
```

### 2. Configurar Google Apps Script

1. Acesse [script.google.com](https://script.google.com)
2. Crie um novo projeto ou abra o seu
3. Copie os arquivos `.gs.js` e `appsscript.json` do repositório para o editor
4. Salve o projeto

### 3. Habilitar APIs Necessárias

- **Apps Script API**: https://script.google.com/home/usersettings (ativar)
- **Google Drive API**: Já vem habilitada por padrão no Apps Script
- **Gemini API**: Ative em [Google Cloud Console](https://console.cloud.google.com)

### 4. Configurar Script Properties

No Google Apps Script, vá para **Project Settings** ⚙️ e adicione as seguintes propriedades:

| Propriedade | Valor | Obrigatório | Descrição |
|---|---|---|---|
| `GEMINI_API_KEY` | Sua chave da API Gemini | ✅ | Obtenha em [AI Studio](https://aistudio.google.com/apikey) |
| `TELEGRAM_TOKEN` | Token do bot Telegram | ✅ | Obtido via [@BotFather](https://t.me/botfather) |
| `FOLDER_ID` | ID da pasta no Drive | ✅ | Abra a pasta e copie o ID da URL |
| `MODELO_IA` | `gemini-2.5-flash` | ❌ | Modelo padrão (outras opções: `gemini-1.5-flash`, `gemini-1.5-flash-8b`) |
| `WEBHOOK_URL` | URL de deploy do script | ❌ | Necessária apenas para `limparFilaTelegram()` |

**Como obter cada valor:**

#### GEMINI_API_KEY
```
1. Vá para https://aistudio.google.com/apikey
2. Clique "Create API key"
3. Copie a chave
```

#### TELEGRAM_TOKEN
```
1. Abra @BotFather no Telegram
2. /newbot
3. Escolha nome e username
4. Copie o token fornecido
```

#### FOLDER_ID
```
1. Crie uma pasta no Google Drive
2. Abra a pasta
3. copie o ID da URL: https://drive.google.com/drive/folders/[FOLDER_ID]
```

### 5. Fazer Deploy como Executável

1. No editor do Apps Script, clique **Deploy** → **New deployment**
2. Tipo: **Web app**
3. Execute como: Sua conta Google
4. Quem tem acesso: **Anyone** (permitir chamadas do Telegram)
5. Clique **Deploy** e copie a URL de deployment

### 6. Conectar o Webhook do Telegram

Execute a função `limparFilaTelegram()` no console do Apps Script:

```javascript
// No editor, vá para Execute > limparFilaTelegram()
```

Ou configure manualmente via URL:
```
https://api.telegram.org/bot[TELEGRAM_TOKEN]/setWebhook?url=[WEBHOOK_URL]
```

---

## 📝 Como Usar

### Enviar uma nota de voz

1. Abra seu bot no Telegram
2. Envie uma nota de voz (ou arquivo de áudio)
3. O bot responde: "⏳ Recebido! Processando sua voz..."
4. A nota é transcrita, estruturada e salva no Drive
5. Confirmação: "✅ Nota salva com sucesso!"

### Enviar uma mensagem de texto

1. Abra seu bot no Telegram
2. Digite ou cole qualquer texto (ideias, anotações, tarefas)
3. O bot responde: "⏳ Estruturando sua mensagem..."
4. O texto é organizado em Markdown e salvo no Drive
5. Confirmação: "✅ Nota salva com sucesso!"

### Testar localmente

```javascript
testarIntegracaoComIA()
```

Executa no console do Apps Script e verifica:
- Conectividade com a pasta do Drive
- Leitura de arquivos Markdown
- Processamento com Gemini
- Estruturação de dados

---

## 🎯 Customizar para Outros Assistentes

Os prompts são facilmente ajustáveis para qualquer tipo de assistente. Edite as constantes em `Código.js`:

```javascript
const PROMPTS = {
  AUDIO: "Seu prompt para processar áudio",
  TEXTO: "Seu prompt para processar texto"
};
```

### Exemplos de Customização

#### Para um Assistente de Código

```javascript
const PROMPTS = {
  AUDIO: "Você é um expert em programação. Transcreva este áudio e gere snippets de código comentados em Python.",
  TEXTO: "Você é um expert em programação. Analise este código/descrição e formate em Markdown com syntax highlighting:\n\n"
};
```

#### Para um Assistente de Saúde/Fitness

```javascript
const PROMPTS = {
  AUDIO: "Você é um personal trainer. Transcreva esta descrição do treino e organize em formato Markdown com séries, repetições e observações.",
  TEXTO: "Você é um nutricionista. Estruture estas informações alimentares em Markdown com tabela nutricional e recomendações:\n\n"
};
```

#### Para um Assistente de Criatividade

```javascript
const PROMPTS = {
  AUDIO: "Você é um escritor criativo. Transcreva este áudio e expanda em uma história com elementos de ficção científica.",
  TEXTO: "Você é um roteirista. Transforme esta sinopse em um roteiro estruturado em Markdown com cenas e diálogos:\n\n"
};
```

#### Para um Assistente de Estudo

```javascript
const PROMPTS = {
  AUDIO: "Você é um professor. Transcreva esta aula e crie um resumo com tópicos principais, conceitos-chave e exercícios.",
  TEXTO: "Você é um revisor pedagógico. Organize estas anotações de estudo em Markdown com hierarquia de tópicos e flashcards:\n\n"
};
```

---

## 📂 Estrutura do Projeto

```
Assitente-Pessoal-Google/
├── Código.js              # Handler principal (webhook do Telegram)
├── Cerebro.gs.js          # Lógica de processamento com Gemini
├── Scanner.gs.js          # Integração com Google Drive
├── Organizador.gs.js      # Testes e funções auxiliares
├── appsscript.json        # Configuração do Apps Script
└── README.md              # Este arquivo
```

### Fluxo de Processamento

```
Telegram (voz/áudio/texto)
        ↓
    doPost() [Código.js]
        ↓
   ┌────────────────┐
   │ Tipo: Áudio?   │
   └────┬───────┬───┘
        │       │
    Sim │       │ Não (Texto)
        │       │
        ↓       ↓
getTelegramFile() → processarMensagemTexto_()
        ↓               ↓
processarComGemini_() → processarTextoComGemini_()
        ↓               ↓
        └───────┬───────┘
                ↓
        salvarNoDrive()
                ↓
        enviarResposta() → Confirmação no Telegram
```

### Arquitetura do Código

O código foi refatorado seguindo princípios de **Clean Code**:

- **Separação de responsabilidades**: Cada função tem um propósito único
- **Constantes centralizadas**: Mensagens e prompts em objetos imutáveis
- **Nomenclatura descritiva**: Funções privadas terminam com `_`
- **Tratamento de erros robusto**: Validações e logs em todas as camadas
- **Modularização**: Código organizado por seções (Config, API, Drive, etc.)

---

## 🔧 Funções Principais

### `doPost(e)`
Handler principal que recebe webhooks do Telegram. Identifica o tipo de mensagem (voz/audio/texto) e roteia para o processador adequado.

### `processarMensagemAudio_(chatId, message)`
Baixa o áudio do Telegram, envia para Gemini com prompt específico e salva o resultado.

### `processarMensagemTexto_(chatId, message)`
Processa mensagens de texto diretamente com Gemini usando prompt de estruturação.

### `processarComGemini_(audioBlob, promptTexto)`
Envia áudio para a Gemini API. Retorna texto transcrito e formatado.

### `processarTextoComGemini_(texto)`
Envia texto para a Gemini API. Retorna conteúdo estruturado em Markdown.

### `salvarNoDrive(conteudo)`
Cria um arquivo `.md` na pasta configurada com timestamp como nome.

### `listarNovosArquivosMarkdown()`
Varre a pasta Drive e retorna todos os `.md` para processamento em lote.

### `limparFilaTelegram()`
Reseta o webhook do Telegram para limpar fila de mensagens pendentes.

---

## ⚙️ Variáveis de Ambiente

Todas as chaves sensíveis são gerenciadas via **Script Properties** (não são hardcoded no código).

```javascript
// Acessadas internamente via:
const config = getConfig_();
const apiKey = config.GEMINI_API_KEY;
const botToken = config.TELEGRAM_TOKEN;
```

---

## 🐛 Troubleshooting

### "Variável de ambiente ausente: GEMINI_API_KEY"
- Verifique se configurou todas as 3 propriedades obrigatórias em Project Settings

### "Erro ao obter arquivo do Telegram"
- Confirme que o `TELEGRAM_TOKEN` está correto
- Verifique o ID do arquivo enviado

### "Pasta não encontrada no Drive"
- Confirme que o `FOLDER_ID` está correto
- Certifique-se que a pasta é acessível com a conta do Apps Script

### "Erro na API Gemini"
- Verifique se a chave está ativa em [Google Cloud Console](https://console.cloud.google.com)
- Confirme se o modelo escolhido para `MODELO_IA` suporta modo áudio

---

## 🚀 Próximas Melhorias

- [x] Suporte a mensagens de texto
- [x] Refatoração seguindo Clean Code
- [x] Tratamento robusto de erros
- [ ] Suporte a múltiplas mídias (imagem, vídeo, PDF)
- [ ] Persistência de estado em Realtime Database
- [ ] Dashboard de visualização de notas
- [ ] Integração com Google Sheets para analytics
- [ ] Suporte a múltiplos idiomas
- [ ] Sistema de tags e categorização automática

---

## 📄 Licença

MIT License — Sinta-se livre para usar, modificar e distribuir.

---

## 👤 Autor

Desenvolvido com ❤️ — um projeto de automação inteligente para produtividade pessoal

---

**Pronto para começar?**

```bash
git clone https://github.com/Rjj18/Assitente-Pessoal-Google.git
cd Assitente-Pessoal-Google
# Configure as Script Properties e faça deploy!
```

Perguntas? Abra uma [issue](https://github.com/Rjj18/Assitente-Pessoal-Google/issues) 🎉
