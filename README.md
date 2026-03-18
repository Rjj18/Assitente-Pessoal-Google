# Assistente Pessoal Google

Assistente baseado em Google Apps Script para captura de notas via Telegram, processamento com Gemini e distribuição estruturada para Google Drive, Google Tasks e Google Calendar.

O projeto atende dois fluxos operacionais principais:

- ingestão síncrona de mensagens de texto e áudio enviadas ao bot
- processamento assíncrono de arquivos Markdown armazenados no Google Drive

## Objetivo

Reduzir o atrito entre captura e organização de informação pessoal ou operacional. O sistema recebe entradas não estruturadas, normaliza o conteúdo com IA e o encaminha para o destino correto de acordo com o tipo de dado identificado.

## Capacidades

- Recebimento de mensagens de texto e notas de voz via Telegram
- Transcrição e estruturação com Gemini
- Extração de tarefas, eventos e notas livres em JSON
- Persistência de notas em Markdown no Google Drive
- Criação de tarefas no Google Tasks
- Criação de eventos no Google Calendar
- Processamento em lote de arquivos Markdown pendentes
- Controle básico de rate limit para chamadas ao Gemini

## Arquitetura

O projeto está dividido em quatro módulos principais:

- `Código.js`: entrada principal do webhook, integração com Telegram, chamadas ao Gemini e persistência de notas brutas
- `Cerebro.js`: definição do prompt e regras de extração estruturada
- `Organizador.js`: distribuição dos dados extraídos para Drive, Tasks e Calendar
- `Scanner.js`: leitura de arquivos Markdown pendentes para processamento em lote

Fluxo principal:

```text
Telegram -> Webhook Apps Script -> Gemini -> JSON estruturado -> Drive / Tasks / Calendar
```

Fluxo em lote:

```text
Drive (arquivos .md) -> Scanner -> Gemini -> Organizador -> Arquivo movido para processados
```

## Estrutura do Repositório

```text
.
├── Código.js
├── Cerebro.js
├── Organizador.js
├── Scanner.js
├── appsscript.json
└── README.md
```

## Requisitos

- Conta Google com Google Apps Script habilitado
- Projeto Google Apps Script vinculado ao `scriptId` correto
- Bot do Telegram criado no BotFather
- Chave de API do Gemini
- Pastas do Google Drive para entrada, saída e processados
- Serviços avançados do Apps Script habilitados para Google Tasks e Google Calendar
- `clasp` para sincronização local com o Apps Script

## Configuração

### 1. Clonar o repositório

```bash
git clone https://github.com/Rjj18/Assitente-Pessoal-Google.git
cd Assitente-Pessoal-Google
```

### 2. Instalar e autenticar o `clasp`

```bash
npm install -g @google/clasp
clasp login
```

### 3. Sincronizar o projeto Apps Script

```bash
clasp pull
```

### 4. Configurar propriedades do script

No editor do Google Apps Script, em `Project Settings > Script properties`, configure:

| Propriedade | Obrigatória | Descrição |
| --- | --- | --- |
| `GEMINI_API_KEY` | Sim | Chave de API do Gemini |
| `TELEGRAM_TOKEN` | Sim | Token do bot Telegram |
| `FOLDER_ID` | Sim | Pasta de entrada para notas brutas |
| `PROCESSED_FOLDER_ID` | Sim | Pasta para arquivos já processados |
| `GENERAL_NOTES_FOLDER_ID` | Sim | Pasta onde as notas livres categorizadas serão mantidas |
| `MODELO_IA` | Não | Modelo padrão do Gemini |
| `MODELOS_PERMITIDOS` | Não | Lista adicional de modelos permitidos |
| `WEBHOOK_URL` | Não | URL pública do deploy Apps Script |
| `TELEGRAM_ADMIN_CHAT_ID` | Não | Chat de notificação operacional |
| `GEMINI_MIN_INTERVAL_MS` | Não | Intervalo mínimo entre chamadas ao Gemini |
| `GEMINI_DAILY_LIMIT` | Não | Limite diário global (fallback) para estimativa de requisições restantes no `/status` (padrão: 20) |
| `GEMINI_DAILY_LIMIT_<MODELO_NORMALIZADO>` | Não | Limite diário por modelo, por exemplo `GEMINI_DAILY_LIMIT_GEMINI_2_5_FLASH` |
| `MAX_ARQUIVOS_POR_BATCH` | Não | Limite de arquivos por execução em lote |
| `PROCESSAMENTO_DIARIO_HORA` | Não | Hora do trigger automático |
| `PROCESSAMENTO_DIARIO_MINUTO` | Não | Minuto do trigger automático |

### 5. Configurar o webhook do Telegram

Depois do deploy como Web App, use a URL publicada pelo Apps Script e registre o webhook com a função utilitária existente no projeto ou diretamente pela API do Telegram.

## Deploy

### Publicar alterações no Apps Script

```bash
clasp push
```

### Abrir o projeto remoto

```bash
clasp open
```

### Fluxo recomendado de trabalho

```bash
clasp pull
# editar arquivos locais
clasp push
```

## Execução Operacional

### Entrada via Telegram

O webhook recebe mensagens em `doPost(e)` e distingue três cenários:

- áudio ou voz
- mensagem de texto
- comandos operacionais, como `/modelo`, `/processar` e `/status`

Para texto e áudio, o conteúdo é enviado ao Gemini e o retorno é salvo ou distribuído conforme o fluxo usado.

Comando adicional disponível no Telegram:

- `/hoje`: gera um resumo do dia com compromissos da agenda e tarefas (hoje + atrasadas), envia no chat e salva como nota em `GENERAL_NOTES_FOLDER_ID`.
- `/semana`: gera um resumo da semana atual com compromissos da agenda e tarefas (semana + atrasadas), envia no chat e salva como nota em `GENERAL_NOTES_FOLDER_ID`.
- `/status`: mostra status operacional (modelo atual, throttle, webhook, pendências e consumo Gemini).

Regras do consumo exibido no `/status`:

- A contagem é por modelo (`MODELO_IA`) e por projeto.
- O reset diário segue meia-noite do horário do Pacífico (`America/Los_Angeles`).
- "Requisições restantes" é uma estimativa local baseada em `GEMINI_DAILY_LIMIT_<MODELO_NORMALIZADO>` (ou `GEMINI_DAILY_LIMIT` como fallback).
- Se nenhum limite for configurado, o sistema usa `20` requisições/dia como padrão.

Formato da nota gerada por `/hoje`:

- Título da entrada no formato `YYYY-MM-DD`
- Arquivo diário dedicado no formato `YYYY-MM-DD.md` (atualiza o mesmo arquivo no dia)
- Bloco de reflexão para começar o dia
- Agenda em callout `info`
- Tag sugerida: `#dailynote`

### Processamento em lote

O comando `/processar` dispara a leitura de arquivos Markdown pendentes e envia o conteúdo para extração estruturada. Ao final, o sistema:

- cria tarefas em Google Tasks
- cria eventos em Google Calendar
- agrega notas livres por categoria no Drive
- move o arquivo original para a pasta de processados

## Modelo de Dados Esperado

O módulo de extração espera um JSON com a seguinte estrutura lógica:

```json
{
  "tarefas": [
    {
      "titulo": "Resumo acionável da tarefa",
      "detalhes": "Contexto adicional"
    }
  ],
  "notas_livres": [
    {
      "titulo": "Tema da nota",
      "conteudo": "Anotações completas e formatadas",
      "categoria": "projetos|estudos|artigos|ideias|work_routine",
      "tags_sugeridas": ["tag1", "tag2"]
    }
  ],
  "eventos": [
    {
      "titulo": "Nome do evento",
      "data_inicio": "YYYY-MM-DD",
      "hora_inicio": "HH:mm",
      "data_fim": "YYYY-MM-DD",
      "hora_fim": "HH:mm",
      "data_sugerida_original": "Texto original"
    }
  ]
}
```

## Funções Operacionais Úteis

- `processarArquivosMarkdown()`: executa o processamento em lote
- `configurarTriggersAutomaticos()`: recria o trigger diário de processamento
- `listarTriggersProcessamento()`: lista os triggers existentes
- `listarModelosDisponiveis()`: consulta modelos Gemini suportados
- `testarSuporteAudio(nomeModelo)`: valida suporte a áudio em um modelo específico
- `testarIntegracaoComIA()`: executa um teste simples de integração
- `limparFilaTelegram()`: remove atualizações pendentes e reconfigura o webhook

## Desenvolvimento com Docker

O ambiente local pode ser usado via Docker para evitar dependências instaladas no host.

Subir o ambiente:

```bash
sudo docker compose up -d
```

Executar comandos `clasp` no container:

```bash
sudo docker exec workspace-gas sh -c 'cd /workspace && clasp pull'
sudo docker exec workspace-gas sh -c 'cd /workspace && clasp push'
```

## Segurança e Boas Práticas

- Não versionar `.clasprc.json` ou `.clasp.json`
- Manter segredos exclusivamente em Script Properties
- Validar IDs de pastas e tokens antes de colocar o webhook em produção
- Monitorar erros de quota do Gemini e ajustar `GEMINI_MIN_INTERVAL_MS` se necessário
- Revisar periodicamente os prompts para evitar deriva de saída estrutural
- Tratar o retorno do modelo como entrada não confiável e manter validação defensiva

## Limitações Conhecidas

- A qualidade da extração depende do modelo Gemini selecionado
- Datas ambíguas podem exigir ajuste manual no Calendar
- Áudios com baixa qualidade impactam a transcrição e a categorização
- O fluxo de lote depende da integridade dos arquivos Markdown e do acesso correto às pastas no Drive

## Observações de Manutenção

- Alterações em prompt e contrato JSON devem ser refletidas no módulo que persiste as notas
- Mudanças de nomenclatura de arquivos locais devem ser verificadas antes do `clasp push`


## Repositório

Origem Git:

`https://github.com/Rjj18/Assitente-Pessoal-Google`

## Licença

MIT. Veja o arquivo `LICENSE`.