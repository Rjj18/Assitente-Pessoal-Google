// ==================== CONSTANTES ====================

const MENSAGENS = {
  PROCESSANDO_VOZ: "⏳ Recebido! Processando sua voz...",
  PROCESSANDO_TEXTO: "⏳ Estruturando sua mensagem...",
  PROCESSANDO_RESUMO_DIA: "⏳ Montando seu resumo do dia...",
  PROCESSANDO_RESUMO_SEMANA: "⏳ Montando seu resumo da semana...",
  SUCESSO: "✅ Nota salva com sucesso!",
  ERRO_GEMINI: "❌ Não foi possível processar. Tente novamente.",
  ERRO_LIMITE_GEMINI: "⚠️ A API do Gemini atingiu o limite temporário de requisições. Tente novamente em alguns minutos.",
  ERRO_TECNICO: "⚠️ Erro técnico: ",
  SEM_CONTEUDO: "📝 Envie uma mensagem de texto ou nota de voz para processar."
};

const PROMPTS = {
  AUDIO: "Você é um assistente pessoal focado em captura rápida de notas. Transcreva este áudio em português do Brasil, preserve o sentido original e melhore apenas pontuação, quebras de linha e gramática. Não invente fatos, datas, tarefas, eventos, nomes ou conclusões. Retorne somente Markdown puro, sem bloco de código. \n\n⚠️ IMPORTANTE: Se o usuário mencionar hashtags (ex: #linkedin, #proximo-passo, #bug), preserve-as exatamente como ditas.\n\nUse esta estrutura sempre que fizer sentido:\n\n## Título curto e objetivo\n\n### Captura\nTexto reescrito com clareza, preservando o conteúdo original.\n\n### Pontos-chave\n- itens curtos com fatos, decisões, ideias, nomes, datas e pendências mencionadas\n\n### Tags originais\nSe o usuário mencionou hashtags: #hashtag1 #hashtag2\n(vazio se não mencionou)\n\n### Contexto adicional\n- observações úteis apenas se existirem\n\nNo final, adicione de 1 a 3 tags adicionais relevantes em uma única linha, no formato #tag. Se não houver contexto suficiente para classificar bem, use apenas #captura. Não transforme automaticamente em checklist se o áudio não trouxer pendências explícitas.",
  TEXTO: "Você é um assistente pessoal focado em organizar capturas rápidas. Reescreva o texto abaixo em Markdown puro para Obsidian, preservando integralmente o sentido original e melhorando apenas clareza, formatação e estrutura. Não invente fatos, datas, responsáveis, tarefas ou eventos. Retorne somente Markdown puro, sem bloco de código. \n\n⚠️ IMPORTANTE: Se o usuário mencionou hashtags (ex: #linkedin, #proximo-passo, #bug), preserve-as exatamente como mencionadas.\n\nUse esta estrutura sempre que fizer sentido:\n\n## Título curto e objetivo\n\n### Captura\nTexto reorganizado com clareza.\n\n### Pontos-chave\n- itens curtos com fatos, decisões, ideias, nomes, datas e pendências mencionadas\n\n### Tags originais\nSe o usuário mencionou hashtags: #hashtag1 #hashtag2\n(vazio se não mencionou)\n\n### Contexto adicional\n- observações úteis apenas se existirem\n\nNo final, adicione de 1 a 3 tags adicionais relevantes em uma única linha, no formato #tag. Se não houver contexto suficiente para classificar bem, use apenas #captura. Só use checklist quando o texto trouxer ação explícita.\n\nTexto de entrada:\n\n"
};

const MODELOS_PADRAO = [
  'gemini-2.5-pro',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
  'gemini-2.5-flash',
  'gemini-2.5-flash-preview-tts'
];

const GEMINI_DAILY_LIMIT_PADRAO = 20;

// ==================== CONFIGURAÇÃO ====================

function getEnvOrThrow_(key) {
  const value = PropertiesService.getScriptProperties().getProperty(key);
  if (!value) {
    throw new Error('Variavel de ambiente ausente: ' + key);
  }
  return value;
}

function montarListaModelosPermitidos_(valorProperty) {
  const modelosCustom = (valorProperty || '')
    .split(/[\n,;]+/)
    .map(modelo => modelo.trim())
    .filter(modelo => modelo);

  const modelosFinais = Array.from(new Set(MODELOS_PADRAO.concat(modelosCustom)));
  return modelosFinais.join(',');
}

function getConfig_() {
  const props = PropertiesService.getScriptProperties();
  return {
    GEMINI_API_KEY: getEnvOrThrow_('GEMINI_API_KEY'),
    FOLDER_ID: getEnvOrThrow_('FOLDER_ID'),
    TELEGRAM_TOKEN: getEnvOrThrow_('TELEGRAM_TOKEN'),
    PROCESSED_FOLDER_ID: getEnvOrThrow_('PROCESSED_FOLDER_ID'),
    GENERAL_NOTES_FOLDER_ID: getEnvOrThrow_('GENERAL_NOTES_FOLDER_ID'),
    MODELO_IA: props.getProperty('MODELO_IA') || 'gemini-2.5-flash',
    MODELOS_PERMITIDOS: montarListaModelosPermitidos_(props.getProperty('MODELOS_PERMITIDOS')),
    TELEGRAM_ADMIN_CHAT_ID: props.getProperty('TELEGRAM_ADMIN_CHAT_ID') || '',
    WEBHOOK_URL: props.getProperty('WEBHOOK_URL') || '',
    GEMINI_MIN_INTERVAL_MS: Number(props.getProperty('GEMINI_MIN_INTERVAL_MS') || '3000'),
    GEMINI_DAILY_LIMIT: Number(props.getProperty('GEMINI_DAILY_LIMIT') || String(GEMINI_DAILY_LIMIT_PADRAO)),
    MAX_ARQUIVOS_POR_BATCH: Number(props.getProperty('MAX_ARQUIVOS_POR_BATCH') || '10')
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
  try {
    enviarResposta(chatId, MENSAGENS.PROCESSANDO_VOZ);

    const audioObj = message.voice || message.audio;
    const fileId = audioObj.file_id;

    if (!fileId || !String(fileId).trim()) {
      throw new Error("fileId inválido no áudio");
    }

    const fileUrl = getTelegramFile(fileId);
    const options = { method: "get", timeout: 60 };
    const audioBlob = UrlFetchApp.fetch(fileUrl, options).getBlob();
    
    // Validação de tamanho e tipo
    if (!audioBlob || audioBlob.getBytes().length === 0) {
      throw new Error("Áudio vazio ou corrompido");
    }

    const markdown = processarComGemini_(audioBlob, PROMPTS.AUDIO);
    finalizarProcessamento_(chatId, markdown);
  } catch (erro) {
    if (isGeminiRateLimitError_(erro)) {
      enviarResposta(chatId, MENSAGENS.ERRO_LIMITE_GEMINI);
      notificarRateLimitGemini_("Fluxo de áudio");
      return;
    }
    Logger.log("Erro ao processar áudio: " + erro.toString());
    enviarResposta(chatId, MENSAGENS.ERRO_TECNICO + erro.message);
  }
}

function processarMensagemTexto_(chatId, message) {
  const textoUsuario = message.text.trim();

  if (textoUsuario === '/modelo' || textoUsuario.startsWith('/modelo ')) {
    processarComandoModelo_(chatId, textoUsuario);
    return;
  }
  
  // Verifica se é o comando /processar
  if (textoUsuario === '/processar') {
    enviarResposta(chatId, "⏳ Iniciando processamento de arquivos...");
    
    try {
      const resumo = processarArquivosMarkdown();
      
      if (resumo.arquivosProcessados === 0 && resumo.erros.length === 0) {
        enviarResposta(chatId, "📭 Nenhum arquivo novo encontrado para processar.");
      } else if (resumo.arquivosProcessados === 0 && resumo.erros.length > 0) {
        enviarResposta(chatId, "⚠️ O processamento não concluiu. Erros: " + resumo.erros.length + "\nUse /modelo para revisar/trocar o modelo atual.");
      } else {
        const mensagem = `✅ Processamento concluído!\n\n` +
          `📄 Arquivos: ${resumo.arquivosProcessados}\n` +
          `✓ Tarefas: ${resumo.totalTarefas}\n` +
          `📅 Eventos: ${resumo.totalEventos}\n` +
          `📝 Notas: ${resumo.totalNotas}` +
          (resumo.arquivosRestantes > 0 ? `\n\n⏳ Restantes: ${resumo.arquivosRestantes} (próximo batch)` : '') +
          (resumo.erros.length > 0 ? `\n\n⚠️ Erros: ${resumo.erros.length}` : '');
        
        enviarResposta(chatId, mensagem);
      }
    } catch (erro) {
      enviarResposta(chatId, "❌ Erro ao processar: " + erro.message);
      Logger.log("Erro no comando /processar: " + erro.toString());
    }
    
    return;
  }

  if (textoUsuario === '/hoje') {
    processarComandoHoje_(chatId);
    return;
  }

  if (textoUsuario === '/semana') {
    processarComandoSemana_(chatId);
    return;
  }

  if (textoUsuario === '/status') {
    processarComandoStatus_(chatId);
    return;
  }
  
  // Processamento normal de texto
  try {
    enviarResposta(chatId, MENSAGENS.PROCESSANDO_TEXTO);
    const markdown = processarTextoComGemini_(textoUsuario);
    finalizarProcessamento_(chatId, markdown);
  } catch (erro) {
    if (isGeminiRateLimitError_(erro)) {
      enviarResposta(chatId, MENSAGENS.ERRO_LIMITE_GEMINI);
      notificarRateLimitGemini_("Fluxo de texto");
      return;
    }
    throw erro;
  }
}

function processarComandoModelo_(chatId, textoUsuario) {
  const config = getConfig_();
  const modelosPermitidos = config.MODELOS_PERMITIDOS.split(',').map(modelo => modelo.trim()).filter(modelo => modelo);
  const partes = textoUsuario.split(/\s+/).filter(parte => parte);

  if (partes.length === 1) {
    const resposta = "🤖 Modelo atual: " + config.MODELO_IA +
      "\n\nModelos permitidos:" +
      "\n- " + modelosPermitidos.join("\n- ") +
      "\n\nPara trocar: /modelo nome-do-modelo";
    enviarResposta(chatId, resposta);
    return;
  }

  const novoModelo = partes.slice(1).join(' ').trim();
  if (modelosPermitidos.indexOf(novoModelo) === -1) {
    enviarResposta(chatId, "❌ Modelo não permitido: " + novoModelo + "\nUse /modelo para ver a lista disponível.");
    return;
  }

  PropertiesService.getScriptProperties().setProperty('MODELO_IA', novoModelo);
  enviarResposta(chatId, "✅ Modelo atualizado para: " + novoModelo);
}

function processarComandoHoje_(chatId) {
  enviarResposta(chatId, MENSAGENS.PROCESSANDO_RESUMO_DIA);

  try {
    const resumo = gerarResumoDiaHoje_();

    const mensagem = resumo.resumoTelegram +
      "\n\n📌 Nota salva no Drive." +
      "\n📅 Compromissos: " + resumo.totalCompromissos +
      "\n✅ Tarefas: " + resumo.totalTarefas;

    enviarResposta(chatId, limitarMensagemTelegram_(mensagem));
  } catch (erro) {
    Logger.log("Erro no comando /hoje: " + erro.toString());
    enviarResposta(chatId, "❌ Não foi possível gerar seu resumo do dia: " + erro.message);
  }
}

function processarComandoSemana_(chatId) {
  enviarResposta(chatId, MENSAGENS.PROCESSANDO_RESUMO_SEMANA);

  try {
    const resumo = gerarResumoSemanaAtual_();

    const mensagem = resumo.resumoTelegram +
      "\n\n📌 Nota salva no Drive." +
      "\n📅 Compromissos: " + resumo.totalCompromissos +
      "\n✅ Tarefas: " + resumo.totalTarefas;

    enviarResposta(chatId, limitarMensagemTelegram_(mensagem));
  } catch (erro) {
    Logger.log("Erro no comando /semana: " + erro.toString());
    enviarResposta(chatId, "❌ Não foi possível gerar seu resumo da semana: " + erro.message);
  }
}

function processarComandoStatus_(chatId) {
  try {
    const config = getConfig_();

    const props = PropertiesService.getScriptProperties();
    const modeloAtual = config.MODELO_IA;
    const dataPacifico = obterDataPacificoAtual_();
    const chaveContador = obterChaveContadorGemini_(modeloAtual, dataPacifico);
    const requisicoesHoje = Number(props.getProperty(chaveContador) || '0');
    const limiteInfo = obterLimiteDiarioGeminiModelo_(modeloAtual, props);
    const restantesEstimadas = limiteInfo.limite > 0 ? Math.max(0, limiteInfo.limite - requisicoesHoje) : null;
    const pendencias = contarPendenciasMarkdown_();
    const webhookConfigurado = !!String(config.WEBHOOK_URL || '').trim();
    const webhookResumo = webhookConfigurado ? config.WEBHOOK_URL : 'não configurado';
    const janela = obterJanelaRpdPacifico_();

    const linhas = [
      "📊 Status do bot",
      "🤖 Modelo atual: " + modeloAtual,
      "📈 Requisições hoje (PT): " + requisicoesHoje,
      "⏱️ Throttle Gemini: " + config.GEMINI_MIN_INTERVAL_MS + "ms",
      "📦 Pendências .md: " + pendencias,
      "🪝 Webhook: " + webhookResumo,
      "",
      "🕒 Janela RPD (Pacific): " + janela.inicioPacifico + " -> " + janela.fimPacifico,
      "🇧🇷 Equivalente (São Paulo): " + janela.inicioSaoPaulo + " -> " + janela.fimSaoPaulo,
      ""
    ];

    if (limiteInfo.limite > 0) {
      linhas.push("🎯 Limite diário configurado: " + limiteInfo.limite + " (" + limiteInfo.chaveUsada + ")");
      linhas.push("🧮 Restantes estimadas (janela PT): " + restantesEstimadas);
    } else {
      linhas.push("🎯 Limite diário: não configurado");
      linhas.push("🧮 Restantes estimadas: configure " + limiteInfo.chaveSugerida + " (ou GEMINI_DAILY_LIMIT)");
    }

    enviarResposta(chatId, limitarMensagemTelegram_(linhas.join("\n")));
  } catch (erro) {
    Logger.log("Erro no comando /status: " + erro.toString());
    enviarResposta(chatId, "❌ Não foi possível montar o status: " + erro.message);
  }
}

function obterDataPacificoAtual_() {
  return Utilities.formatDate(new Date(), 'America/Los_Angeles', 'yyyy-MM-dd');
}

function normalizarModeloParaChave_(modelo) {
  return String(modelo || 'modelo_desconhecido')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function obterChaveContadorGemini_(modelo, dataPacifico) {
  return 'GEMINI_RPD_' + normalizarModeloParaChave_(modelo) + '_' + dataPacifico;
}

function obterLimiteDiarioGeminiModelo_(modelo, props) {
  const chaveModelo = 'GEMINI_DAILY_LIMIT_' + normalizarModeloParaChave_(modelo);
  const valorModelo = Number((props.getProperty(chaveModelo) || '').trim());
  if (!isNaN(valorModelo) && valorModelo > 0) {
    return {
      limite: valorModelo,
      chaveUsada: chaveModelo,
      chaveSugerida: chaveModelo
    };
  }

  const valorGlobal = Number((props.getProperty('GEMINI_DAILY_LIMIT') || '').trim());
  if (!isNaN(valorGlobal) && valorGlobal > 0) {
    return {
      limite: valorGlobal,
      chaveUsada: 'GEMINI_DAILY_LIMIT',
      chaveSugerida: chaveModelo
    };
  }

  return {
    limite: GEMINI_DAILY_LIMIT_PADRAO,
    chaveUsada: 'GEMINI_DAILY_LIMIT_PADRAO',
    chaveSugerida: chaveModelo
  };
}

function obterOffsetMinutosTimezone_(data, timezone) {
  const offset = Utilities.formatDate(data, timezone, 'Z');
  const sinal = offset.charAt(0) === '-' ? -1 : 1;
  const horas = Number(offset.substring(1, 3));
  const minutos = Number(offset.substring(3, 5));
  return sinal * ((horas * 60) + minutos);
}

function converterDataHoraTimezoneParaUtc_(ano, mes, dia, hora, minuto, segundo, timezone) {
  let utcEstimado = Date.UTC(ano, mes - 1, dia, hora, minuto, segundo);

  // Itera para estabilizar offset em dias de troca de DST.
  for (let i = 0; i < 3; i++) {
    const dataEstimativa = new Date(utcEstimado);
    const offsetMinutos = obterOffsetMinutosTimezone_(dataEstimativa, timezone);
    utcEstimado = Date.UTC(ano, mes - 1, dia, hora, minuto, segundo) - (offsetMinutos * 60000);
  }

  return new Date(utcEstimado);
}

function obterJanelaRpdPacifico_() {
  const dataPacifico = obterDataPacificoAtual_();
  const partes = dataPacifico.split('-').map(parte => Number(parte));
  const ano = partes[0];
  const mes = partes[1];
  const dia = partes[2];

  const inicioUtc = converterDataHoraTimezoneParaUtc_(ano, mes, dia, 0, 0, 0, 'America/Los_Angeles');
  const fimUtc = converterDataHoraTimezoneParaUtc_(ano, mes, dia, 23, 59, 59, 'America/Los_Angeles');

  return {
    dataPacifico: dataPacifico,
    inicioPacifico: Utilities.formatDate(inicioUtc, 'America/Los_Angeles', 'yyyy-MM-dd HH:mm:ss z'),
    fimPacifico: Utilities.formatDate(fimUtc, 'America/Los_Angeles', 'yyyy-MM-dd HH:mm:ss z'),
    inicioSaoPaulo: Utilities.formatDate(inicioUtc, 'America/Sao_Paulo', 'yyyy-MM-dd HH:mm:ss z'),
    fimSaoPaulo: Utilities.formatDate(fimUtc, 'America/Sao_Paulo', 'yyyy-MM-dd HH:mm:ss z')
  };
}

function contarPendenciasMarkdown_() {
  try {
    const config = getConfig_();
    const pastaEntrada = DriveApp.getFolderById(config.FOLDER_ID);
    const arquivos = pastaEntrada.getFilesByType(MimeType.PLAIN_TEXT);
    let total = 0;

    while (arquivos.hasNext()) {
      const arquivo = arquivos.next();
      if (arquivo.getName().toLowerCase().endsWith('.md')) {
        total++;
      }
    }

    return total;
  } catch (erro) {
    Logger.log('Erro ao contar pendências Markdown: ' + erro.toString());
    return -1;
  }
}

function limitarMensagemTelegram_(texto) {
  const limite = 4096;
  const textoLimpo = String(texto || '').trim();

  if (!textoLimpo) {
    return '';
  }

  if (textoLimpo.length <= limite) {
    return textoLimpo;
  }

  return textoLimpo.substring(0, limite - 20) + "\n\n...(resumo truncado)";
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
  
  const options = {
    method: "get",
    timeout: 30,
    muteHttpExceptions: true
  };
  
  const resp = UrlFetchApp.fetch(url, options);
  
  if (resp.getResponseCode() >= 400) {
    throw new Error('Erro HTTP ao obter arquivo: ' + resp.getResponseCode());
  }
  
  const json = JSON.parse(resp.getContentText());
  
  if (!json.ok || !json.result || !json.result.file_path) {
    throw new Error('Erro ao obter arquivo do Telegram: ' + JSON.stringify(json));
  }
  
  return `https://api.telegram.org/file/bot${config.TELEGRAM_TOKEN}/${json.result.file_path}`;
}

function enviarResposta(chatId, texto) {
  // Validação de entrada
  if (!chatId || !String(chatId).trim()) {
    Logger.log("Aviso: enviarResposta() chamada com chatId inválido");
    return false;
  }
  if (!texto || !String(texto).trim()) {
    Logger.log("Aviso: enviarResposta() chamada com texto vazio");
    return false;
  }
  
  const config = getConfig_();
  const url = `https://api.telegram.org/bot${config.TELEGRAM_TOKEN}/sendMessage`;
  
  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({
      chat_id: chatId,
      text: String(texto).substring(0, 4096)
    }),
    muteHttpExceptions: true,
    timeout: 30
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    const status = response.getResponseCode();
    if (status >= 400) {
      Logger.log("Erro ao enviar mensagem Telegram (status " + status + "): " + response.getContentText());
      return false;
    }
    return true;
  } catch (erro) {
    Logger.log("Erro crítico ao enviar resposta: " + erro.toString());
    return false;
  }
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
  const json = chamarGeminiJson_(url, payload, "enviarRequisicaoGemini_");
  if (!json) {
    return null;
  }
  return extrairTextoResposta_(json);
}

function chamarGeminiJson_(url, payload, contexto) {
  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const maxTentativas = 3;
  for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
    aplicarThrottleGemini_();

    const res = UrlFetchApp.fetch(url, options);
    const status = res.getResponseCode();
    const body = res.getContentText();

    let json = null;
    try {
      json = JSON.parse(body);
    } catch (erroParse) {
      Logger.log("Erro ao parsear resposta Gemini em " + contexto + ": " + erroParse.toString());
    }

    const mensagemErro = json && json.error ? (json.error.message || "") : "";
    const emRateLimit = status === 429 || /rate|quota|resource exhausted|too many requests/i.test(mensagemErro);

    if (emRateLimit) {
      const esperaMs = obterEsperaRetryGemini_(res, tentativa);
      Logger.log("Rate limit Gemini em " + contexto + " (tentativa " + tentativa + "/" + maxTentativas + "). Aguardando " + esperaMs + "ms");

      if (tentativa === maxTentativas) {
        throw criarErroRateLimitGemini_(mensagemErro || "Limite de requisições por minuto atingido");
      }

      Utilities.sleep(esperaMs);
      continue;
    }

    if (json && json.error) {
      Logger.log("Erro na API Gemini em " + contexto + ": " + json.error.message);
      return null;
    }

    if (!json) {
      Logger.log("Resposta inválida do Gemini em " + contexto + ": status " + status);
      return null;
    }

    return json;
  }

  return null;
}

function aplicarThrottleGemini_() {
  const config = getConfig_();
  const props = PropertiesService.getScriptProperties();
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const minIntervalMs = config.GEMINI_MIN_INTERVAL_MS;
    const ultimoTs = Number(props.getProperty('GEMINI_LAST_REQUEST_TS') || '0');
    const agora = Date.now();
    const esperaMs = Math.max(0, (ultimoTs + minIntervalMs) - agora);

    if (esperaMs > 0) {
      Logger.log("[THROTTLE] Aguardando " + esperaMs + "ms antes da próxima requisição Gemini");
      Utilities.sleep(esperaMs);
    }

    props.setProperty('GEMINI_LAST_REQUEST_TS', String(Date.now()));
    incrementarContadorGeminiNoLock_(props, config.MODELO_IA);
  } finally {
    lock.releaseLock();
  }
}

function incrementarContadorGeminiNoLock_(props, modelo) {
  const dataPacifico = obterDataPacificoAtual_();
  const chaveContador = obterChaveContadorGemini_(modelo, dataPacifico);
  const atual = Number(props.getProperty(chaveContador) || '0');
  props.setProperty(chaveContador, String(atual + 1));
}

function obterEsperaRetryGemini_(res, tentativa) {
  const headers = res.getAllHeaders() || {};
  const retryAfterRaw = headers['Retry-After'] || headers['retry-after'];

  if (retryAfterRaw) {
    const segundos = Number(retryAfterRaw);
    if (!isNaN(segundos) && segundos > 0) {
      return segundos * 1000;
    }
  }

  return Math.min(60000, tentativa * 15000);
}

function criarErroRateLimitGemini_(mensagem) {
  const erro = new Error("GeminiRateLimit: " + mensagem);
  erro.name = 'GeminiRateLimitError';
  return erro;
}

function isGeminiRateLimitError_(erro) {
  return !!(erro && erro.name === 'GeminiRateLimitError');
}

function notificarRateLimitGemini_(contexto) {
  const cache = CacheService.getScriptCache();
  const chave = 'gemini_rate_limit_alerta';
  if (cache.get(chave)) {
    return;
  }

  cache.put(chave, '1', 300);
  const config = getConfig_();
  if (!config.TELEGRAM_ADMIN_CHAT_ID) {
    return;
  }

  const mensagem = "🚨 Rate limit do Gemini detectado.\n" +
    "Contexto: " + contexto + "\n" +
    "Modelo atual: " + config.MODELO_IA + "\n" +
    "Use /modelo para consultar ou /modelo <nome> para trocar.";

  try {
    enviarResposta(config.TELEGRAM_ADMIN_CHAT_ID, mensagem);
  } catch (erro) {
    Logger.log("Erro ao notificar rate limit no Telegram: " + erro.toString());
  }
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

/**
 * Lista modelos Gemini que suportam generateContent e áudio.
 * @return {Array} Array de nomes de modelos compatíveis.
 */
function listarModelosDisponiveis() {
  const config = getConfig_();
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${config.GEMINI_API_KEY}`;
  
  try {
    const response = UrlFetchApp.fetch(url);
    const json = JSON.parse(response.getContentText());
    
    if (!json.models || !Array.isArray(json.models)) {
      throw new Error("Resposta inválida: modelos não encontrados");
    }
    
    const modelosCompativeis = [];
    const modelosComAudio = [];
    
    Logger.log("=== ANALISANDO MODELOS GEMINI ===\n");
    
    json.models.forEach(model => {
      const suportaGenerateContent = model.supportedGenerationMethods && 
                                      model.supportedGenerationMethods.includes("generateContent");
      
      if (!suportaGenerateContent) {
        return; // Pula modelos que não suportam generateContent
      }
      
      const nomeSimplificado = model.name.replace('models/', '');
      
      // Verifica campos que indicam suporte multimodal/áudio
      const temInputTokenLimit = model.inputTokenLimit && model.inputTokenLimit > 0;
      const naoEhEmbedding = !model.name.includes('embedding');
      const naoEhSoTexto = !model.name.includes('text-only');
      
      // Lista modelos conhecidos que suportam áudio
      const modelosAudioConhecidos = [
        'gemini-2.5-pro',
        'gemini-2.5-flash-lite',
        'gemini-2.0-flash',
        'gemini-2.5-flash',
        'gemini-2.5-flash-preview-tts'
      ];
      
      const provavelmenteSuportaAudio = modelosAudioConhecidos.some(nome => 
        nomeSimplificado.includes(nome)
      );
      
      if (naoEhEmbedding && naoEhSoTexto) {
        modelosCompativeis.push(nomeSimplificado);
        
        if (provavelmenteSuportaAudio) {
          modelosComAudio.push(nomeSimplificado);
          Logger.log(`✓ ${nomeSimplificado} (COM ÁUDIO)`);
        } else {
          Logger.log(`○ ${nomeSimplificado} (verificar áudio)`);
        }
        
        Logger.log(`  displayName: ${model.displayName || 'N/A'}`);
        Logger.log(`  inputLimit: ${model.inputTokenLimit || 'N/A'} tokens`);
        Logger.log('');
      }
    });
    
    Logger.log("\n=== RESUMO ===");
    Logger.log("Modelos com generateContent: " + modelosCompativeis.length);
    Logger.log("Modelos com áudio (confirmados): " + modelosComAudio.length);
    Logger.log("\nModelos recomendados para MODELOS_PERMITIDOS:");
    Logger.log(modelosComAudio.join(','));
    
    return modelosComAudio.length > 0 ? modelosComAudio : modelosCompativeis;
    
  } catch (erro) {
    Logger.log("Erro ao listar modelos: " + erro.toString());
    return [];
  }
}

/**
 * Testa se um modelo específico suporta áudio fazendo uma chamada real.
 * @param {string} nomeModelo Nome do modelo (ex: 'gemini-2.0-flash')
 * @return {boolean} True se suporta áudio.
 */
function testarSuporteAudio(nomeModelo) {
  const config = getConfig_();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${nomeModelo}:generateContent?key=${config.GEMINI_API_KEY}`;
  
  // Áudio de teste mínimo (1 segundo de silêncio em OGG)
  const audioTestBase64 = "T2dnUwACAAAAAAAAAABNYXJrAAAAAAAAAG4AAAA=";
  
  const payload = {
    contents: [{
      parts: [
        { text: "teste" },
        { inline_data: { mime_type: "audio/ogg", data: audioTestBase64 } }
      ]
    }]
  };
  
  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    const json = JSON.parse(response.getContentText());
    
    // Se não retornou erro de formato não suportado, provavelmente aceita áudio
    if (json.error) {
      const mensagem = json.error.message || '';
      const naoSuportaAudio = /unsupported|not supported|invalid.*audio/i.test(mensagem);
      Logger.log(`${nomeModelo}: ${naoSuportaAudio ? '✗ NÃO' : '✓ SIM'} suporta áudio`);
      return !naoSuportaAudio;
    }
    
    // Se gerou resposta, suporta áudio
    Logger.log(`${nomeModelo}: ✓ SIM suporta áudio`);
    return true;
    
  } catch (erro) {
    Logger.log(`${nomeModelo}: Erro ao testar - ${erro.toString()}`);
    return false;
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