// ==================== CONSTANTES ====================

const MENSAGENS = {
  PROCESSANDO_VOZ: "⏳ Recebido! Processando sua voz...",
  PROCESSANDO_TEXTO: "⏳ Estruturando sua mensagem...",
  SUCESSO: "✅ Nota salva com sucesso!",
  ERRO_GEMINI: "❌ Não foi possível processar. Tente novamente.",
  ERRO_TECNICO: "⚠️ Erro técnico: ",
  SEM_CONTEUDO: "📝 Envie uma mensagem de texto ou nota de voz para processar."
};

const PROMPTS = {
  AUDIO: "Você é um assistente pessoal. Transcreva este áudio, corrija a gramática e formate em Markdown (.md) para Obsidian com título H2 e tags de categoria ao final.",
  TEXTO: "Você é um assistente pessoal. Organize este texto em Markdown (.md) para Obsidian com título H2, formatação adequada e tags de categoria ao final:\n\n"
};

// ==================== CONFIGURAÇÃO ====================

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

// ==================== WEBHOOK HANDLER ====================

function doPost(e) {
  try {
    const data = parseWebhookData_(e);
    if (!data || !data.message) return;
    
    const chatId = data.message.chat.id;
    const message = data.message;

    // Identifica o tipo de mensagem e processa
    if (temAudio_(message)) {
      processarMensagemAudio_(chatId, message);
    } else if (temTexto_(message)) {
      processarMensagemTexto_(chatId, message);
    } else {
      enviarResposta(chatId, MENSAGENS.SEM_CONTEUDO);
    }
    
  } catch (err) {
    handleErro_(e, err);
  }
}

// ==================== VALIDADORES ====================

function parseWebhookData_(e) {
  try {
    return JSON.parse(e.postData.contents);
  } catch (erro) {
    Logger.log("Erro ao parsear webhook: " + erro.toString());
    return null;
  }
}

function temAudio_(message) {
  return !!(message.voice || message.audio);
}

function temTexto_(message) {
  return !!(message.text && message.text.trim().length > 0);
}

// ==================== PROCESSADORES ====================

function processarMensagemAudio_(chatId, message) {
  enviarResposta(chatId, MENSAGENS.PROCESSANDO_VOZ);
  
  const audioObj = message.voice || message.audio;
  const fileId = audioObj.file_id;
  
  const fileUrl = getTelegramFile(fileId);
  const audioBlob = UrlFetchApp.fetch(fileUrl).getBlob();
  
  const markdown = processarComGemini_(audioBlob, PROMPTS.AUDIO);
  finalizarProcessamento_(chatId, markdown);
}

function processarMensagemTexto_(chatId, message) {
  enviarResposta(chatId, MENSAGENS.PROCESSANDO_TEXTO);
  
  const textoUsuario = message.text.trim();
  const markdown = processarTextoComGemini_(textoUsuario);
  
  finalizarProcessamento_(chatId, markdown);
}

function finalizarProcessamento_(chatId, markdown) {
  if (markdown) {
    salvarNoDrive(markdown);
    enviarResposta(chatId, MENSAGENS.SUCESSO);
  } else {
    enviarResposta(chatId, MENSAGENS.ERRO_GEMINI);
  }
}

function handleErro_(e, err) {
  Logger.log("Erro no webhook: " + err.toString());
  try {
    const data = JSON.parse(e.postData.contents);
    if (data && data.message && data.message.chat) {
      enviarResposta(data.message.chat.id, MENSAGENS.ERRO_TECNICO + err.message);
    }
  } catch(parseError) {
    Logger.log("Impossível notificar usuário do erro: " + parseError.toString());
  }
}

// ==================== TELEGRAM API ====================

function getTelegramFile(fileId) {
  const config = getConfig_();
  const url = `https://api.telegram.org/bot${config.TELEGRAM_TOKEN}/getFile?file_id=${fileId}`;
  
  const resp = UrlFetchApp.fetch(url);
  const json = JSON.parse(resp.getContentText());
  
  if (!json.ok || !json.result || !json.result.file_path) {
    throw new Error('Erro ao obter arquivo do Telegram: ' + JSON.stringify(json));
  }
  
  return `https://api.telegram.org/file/bot${config.TELEGRAM_TOKEN}/${json.result.file_path}`;
}

function enviarResposta(chatId, texto) {
  const config = getConfig_();
  const url = `https://api.telegram.org/bot${config.TELEGRAM_TOKEN}/sendMessage`;
  
  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({
      chat_id: chatId,
      text: texto
    }),
    muteHttpExceptions: true
  };
  
  UrlFetchApp.fetch(url, options);
}

// ==================== GEMINI API ====================

function processarComGemini_(audioBlob, promptTexto) {
  const config = getConfig_();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.MODELO_IA}:generateContent?key=${config.GEMINI_API_KEY}`;
  
  const payload = {
    contents: [{
      parts: [
        { text: promptTexto },
        { 
          inline_data: { 
            mime_type: "audio/ogg", 
            data: Utilities.base64Encode(audioBlob.getBytes()) 
          } 
        }
      ]
    }]
  };

  return enviarRequisicaoGemini_(url, payload);
}

function processarTextoComGemini_(texto) {
  const config = getConfig_();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.MODELO_IA}:generateContent?key=${config.GEMINI_API_KEY}`;
  
  const payload = {
    contents: [{
      parts: [
        { text: PROMPTS.TEXTO + texto }
      ]
    }]
  };

  return enviarRequisicaoGemini_(url, payload);
}

function enviarRequisicaoGemini_(url, payload) {
  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const res = UrlFetchApp.fetch(url, options);
  const json = JSON.parse(res.getContentText());

  if (json.error) {
    Logger.log("Erro na API Gemini: " + json.error.message);
    return null;
  }
  
  return extrairTextoResposta_(json);
}

function extrairTextoResposta_(json) {
  try {
    if (json.candidates && 
        json.candidates.length > 0 && 
        json.candidates[0].content && 
        json.candidates[0].content.parts && 
        json.candidates[0].content.parts.length > 0) {
      return json.candidates[0].content.parts[0].text;
    }
  } catch (erro) {
    Logger.log("Erro ao extrair texto da resposta Gemini: " + erro.toString());
  }
  
  return null;
}

// ==================== GOOGLE DRIVE ====================

function salvarNoDrive(conteudo) {
  const config = getConfig_();
  
  try {
    const pasta = DriveApp.getFolderById(config.FOLDER_ID);
    const nomeArquivo = gerarNomeArquivo_();
    
    pasta.createFile(nomeArquivo, conteudo, MimeType.PLAIN_TEXT);
    Logger.log("Arquivo salvo: " + nomeArquivo);
    
  } catch (erro) {
    throw new Error("Erro ao salvar no Drive: " + erro.toString());
  }
}

function gerarNomeArquivo_() {
  const agora = new Date();
  const timestamp = Utilities.formatDate(agora, "GMT-3", "yyyy-MM-dd_HHmm");
  return `Nota_${timestamp}.md`;
}

// ==================== FUNÇÕES AUXILIARES ====================

function listarModelosDisponiveis() {
  const config = getConfig_();
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${config.GEMINI_API_KEY}`;
  
  try {
    const response = UrlFetchApp.fetch(url);
    const json = JSON.parse(response.getContentText());
    
    if (!json.models || !Array.isArray(json.models)) {
      throw new Error("Resposta inválida: modelos não encontrados");
    }
    
    json.models.forEach(model => {
      const suportaConteudo = model.supportedGenerationMethods && 
                              model.supportedGenerationMethods.includes("generateContent");
      console.log(`Modelo: ${model.name} | Suporta generateContent: ${suportaConteudo}`);
    });
    
  } catch (erro) {
    Logger.log("Erro ao listar modelos: " + erro.toString());
  }
}

function limparFilaTelegram() {
  const config = getConfig_();
  const token = config.TELEGRAM_TOKEN;
  
  if (!config.WEBHOOK_URL) {
    throw new Error('Variavel de ambiente ausente: WEBHOOK_URL');
  }
  
  try {
    // 1. Remove webhook e limpa fila pendente
    const urlDelete = `https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=true`;
    const respostaDelete = UrlFetchApp.fetch(urlDelete);
    console.log("Fila apagada: " + respostaDelete.getContentText());
    
    // 2. Aguarda processamento
    Utilities.sleep(2000);
    
    // 3. Reconfigura webhook
    const urlSet = `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(config.WEBHOOK_URL)}`;
    const respostaSet = UrlFetchApp.fetch(urlSet);
    console.log("Bot religado: " + respostaSet.getContentText());
    
  } catch (erro) {
    Logger.log("Erro ao limpar fila: " + erro.toString());
    throw erro;
  }
}