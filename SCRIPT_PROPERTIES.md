# Script Properties (Apps Script)

Este projeto usa variaveis de ambiente via `PropertiesService.getScriptProperties()`.

Configure estas chaves em: `Project Settings -> Script properties`.

## Obrigatorias

- `GEMINI_API_KEY`
- `TELEGRAM_TOKEN`
- `FOLDER_ID`

## Opcionais

- `MODELO_IA` (padrao: `gemini-2.5-flash`)
- `WEBHOOK_URL` (necessaria apenas para `limparFilaTelegram`)

## Exemplo de valores

```text
GEMINI_API_KEY=...
TELEGRAM_TOKEN=...
FOLDER_ID=...
MODELO_IA=gemini-2.5-flash
WEBHOOK_URL=https://script.google.com/macros/s/SEU_DEPLOY_ID/exec
```

## Observacao

Se alguma variavel obrigatoria estiver ausente, o script vai lancar erro com a chave faltante.
