function getEnvOrThrow_(key) {
  const value = PropertiesService.getScriptProperties().getProperty(key);
  if (!value) {
    throw new Error('Variavel de ambiente ausente: ' + key);
  }
  return value;
}

function getConfig_() {
  const props = PropertiesService.getScriptProperties();
  return {
    GEMINI_API_KEY: getEnvOrThrow_('GEMINI_API_KEY'),
    FOLDER_ID: getEnvOrThrow_('FOLDER_ID'),
    TELEGRAM_TOKEN: getEnvOrThrow_('TELEGRAM_TOKEN'),
    MODELO_IA: props.getProperty('MODELO_IA') || 'gemini-2.5-flash',
    WEBHOOK_URL: props.getProperty('WEBHOOK_URL') || ''
  };
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (!data.message) return;
    
    const chatId = data.message.chat.id;

    // 1. Identifica se é voz ou áudio comum
    const audioObj = data.message.voice || data.message.audio;

    if (audioObj) {
      enviarResposta(chatId, "⏳ Recebido! O Opal (Gemini) está processando sua voz...");
      
      const fileId = audioObj.file_id;
      const fileUrl = getTelegramFile(fileId);
      const audioBlob = UrlFetchApp.fetch(fileUrl).getBlob();
      
      // 2. Processamento com a IA
      const markdown = pedirAoGemini(audioBlob);
      
      if (markdown) {
        // 3. Salva no Drive
        salvarNoDrive(markdown);
        enviarResposta(chatId, "✅ Nota estruturada e salva no Obsidian!");
      } else {
        enviarResposta(chatId, "❌ O Gemini não conseguiu gerar o texto.");
      }
      
    } else {
      enviarResposta(chatId, "Diga algo, Roger! Só consigo processar notas de voz ou arquivos de áudio.");
    }
  } catch (err) {
    // Se der erro, ele te avisa o motivo real no Telegram
    try {
      const chatId = JSON.parse(e.postData.contents).message.chat.id;
      enviarResposta(chatId, "⚠️ Erro Técnico: " + err.message);
    } catch(e) {}
  }
}

function getTelegramFile(fileId) {
  const config = getConfig_();
  const resp = UrlFetchApp.fetch(`https://api.telegram.org/bot${config.TELEGRAM_TOKEN}/getFile?file_id=${fileId}`);
  const path = JSON.parse(resp.getContentText()).result.file_path;
  return `https://api.telegram.org/file/bot${config.TELEGRAM_TOKEN}/${path}`;
}

function pedirAoGemini(blob) {
  const config = getConfig_();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.MODELO_IA}:generateContent?key=${config.GEMINI_API_KEY}`;
  
  const payload = {
    contents: [{
      parts: [
        { text: "Você é um Coordenador Pedagógico sênior. Transcreva este áudio, corrija a gramática e formate em Markdown (.md) para Obsidian com título H2 e tags de categoria ao final." },
        { inline_data: { mime_type: "audio/ogg", data: Utilities.base64Encode(blob.getBytes()) } }
      ]
    }]
  };

  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const res = UrlFetchApp.fetch(url, options);
  const json = JSON.parse(res.getContentText());

  if (json.candidates && json.candidates[0].content) {
    return json.candidates[0].content.parts[0].text;
  } else {
    throw new Error("Erro no Gemini 2.5: " + (json.error ? json.error.message : "Resposta inesperada"));
  }
}

function salvarNoDrive(conteudo) {
  const config = getConfig_();
  const pasta = DriveApp.getFolderById(config.FOLDER_ID);
  const nome = `Nota_${Utilities.formatDate(new Date(), "GMT-3", "yyyy-MM-dd_HHmm")}.md`;
  pasta.createFile(nome, conteudo, MimeType.PLAIN_TEXT);
}

function enviarResposta(chatId, texto) {
  const config = getConfig_();
  UrlFetchApp.fetch(`https://api.telegram.org/bot${config.TELEGRAM_TOKEN}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(texto)}`);
}

function listarModelosDisponiveis() {
  const config = getConfig_();
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${config.GEMINI_API_KEY}`;
  
  const response = UrlFetchApp.fetch(url);
  const json = JSON.parse(response.getContentText());
  
  // Isso vai imprimir a lista no console do Google
  json.models.forEach(model => {
    console.log("Nome do Modelo: " + model.name + " | Suporta Áudio: " + model.supportedGenerationMethods.includes("generateContent"));
  });
}

function limparFilaTelegram() {
  const config = getConfig_();
  const token = config.TELEGRAM_TOKEN;
  if (!config.WEBHOOK_URL) {
    throw new Error('Variavel de ambiente ausente: WEBHOOK_URL');
  }
  
  // 1. Desliga o bot e obriga o Telegram a apagar TODAS as mensagens pendentes (drop_pending_updates=true)
  const respostaDelete = UrlFetchApp.fetch(`https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=true`);
  console.log("Fila apagada: " + respostaDelete.getContentText());
  
  // 2. Aguarda 2 segundos para os servidores do Telegram processarem a limpeza
  Utilities.sleep(2000);
  
  // 3. Religa o bot com uma ficha limpa
  const respostaSet = UrlFetchApp.fetch(`https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(config.WEBHOOK_URL)}`);
  console.log("Bot religado: " + respostaSet.getContentText());
}