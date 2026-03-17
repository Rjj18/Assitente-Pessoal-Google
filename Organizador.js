// ==================== MOVIMENTAÇÃO DE ARQUIVOS ====================

/**
 * Move um arquivo para uma pasta específica.
 * @param {string} arquivoId ID do arquivo a ser movido.
 * @param {string} pastaDestinoId ID da pasta de destino.
 */
function moverArquivo(arquivoId, pastaDestinoId) {
  try {
    const arquivo = DriveApp.getFileById(arquivoId);
    const pastaDestino = DriveApp.getFolderById(pastaDestinoId);
    
    // Remove o arquivo de todas as pastas atuais
    const pastasAtuais = arquivo.getParents();
    while (pastasAtuais.hasNext()) {
      const pastaAtual = pastasAtuais.next();
      pastaAtual.removeFile(arquivo);
    }
    
    // Adiciona na pasta de destino
    pastaDestino.addFile(arquivo);
    Logger.log("[ORGANIZADOR] Arquivo movido: " + arquivo.getName() + " → " + pastaDestino.getName());
    
  } catch (erro) {
    Logger.log("[ORGANIZADOR] Erro ao mover arquivo: " + erro.toString());
    throw erro;
  }
}

/**
 * Move arquivo para a pasta de processados.
 * @param {string} arquivoId ID do arquivo processado.
 */
function moverParaProcessados(arquivoId) {
  const config = getConfig_();
  moverArquivo(arquivoId, config.PROCESSED_FOLDER_ID);
}

// ==================== INTEGRAÇÃO GOOGLE TASKS ====================

/**
 * Obtém o ID da primeira lista de tarefas do usuário.
 * @return {string} ID da lista padrão.
 */
function obterListaPadraoTasks() {
  try {
    const listas = Tasks.Tasklists.list();
    if (!listas.items || listas.items.length === 0) {
      throw new Error("Nenhuma lista de tarefas encontrada");
    }
    return listas.items[0].id;
  } catch (erro) {
    Logger.log("[ORGANIZADOR] Erro ao obter lista de tarefas: " + erro.toString());
    throw erro;
  }
}

/**
 * Envia tarefas para o Google Tasks.
 * @param {Array} tarefas Array de objetos {titulo, detalhes}.
 * @return {number} Número de tarefas criadas.
 */
function enviarTarefasParaTasks(tarefas) {
  if (!tarefas || tarefas.length === 0) {
    return 0;
  }
  
  let contador = 0;
  const listaId = obterListaPadraoTasks();
  
  tarefas.forEach(tarefa => {
    try {
      Tasks.Tasks.insert({
        title: tarefa.titulo,
        notes: tarefa.detalhes || ''
      }, listaId);
      
      contador++;
      Logger.log("[ORGANIZADOR] Tarefa criada: " + tarefa.titulo);
      
    } catch (erro) {
      Logger.log("[ORGANIZADOR] Erro ao criar tarefa '" + tarefa.titulo + "': " + erro.toString());
    }
  });
  
  return contador;
}

// ==================== PARSER DE DATAS ====================

/**
 * Extrai data estruturada de texto usando IA.
 * @param {string} textoData Texto com referência a data (ex: "amanhã às 14h").
 * @return {Object|null} Objeto {inicio, fim} com datas no formato YYYY-MM-DD ou null.
 */
function extrairDataComIA(textoData) {
  const config = getConfig_();
  const dataAtual = Utilities.formatDate(new Date(), "GMT-3", "yyyy-MM-dd");
  const horaAtual = Utilities.formatDate(new Date(), "GMT-3", "HH:mm");
  
  const prompt = `Hoje é ${dataAtual} às ${horaAtual}. Extraia a data do texto: "${textoData}".
Retorne APENAS um JSON válido com formato:
{"inicio": "YYYY-MM-DD", "fim": "YYYY-MM-DD"}

Se não for possível determinar a data, retorne: null

Exemplos:
- "amanhã às 14h" → {"inicio": "próxima data", "fim": "próxima data"}
- "próxima sexta" → {"inicio": "data da sexta", "fim": "data da sexta"}
- "daqui 3 dias" → {"inicio": "data + 3 dias", "fim": "data + 3 dias"}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.MODELO_IA}:generateContent?key=${config.GEMINI_API_KEY}`;
  
  const payload = {
    "contents": [{"parts": [{"text": prompt}]}],
    "generationConfig": {
      "responseMimeType": "application/json"
    }
  };

  try {
    const jsonResponse = chamarGeminiJson_(url, payload, "extrairDataComIA");
    if (!jsonResponse) {
      return null;
    }
    
    if (jsonResponse.error) {
      Logger.log("[ORGANIZADOR] Erro na API Gemini ao extrair data: " + jsonResponse.error.message);
      return null;
    }
    
    if (jsonResponse.candidates && jsonResponse.candidates.length > 0 && 
        jsonResponse.candidates[0].content && jsonResponse.candidates[0].content.parts && 
        jsonResponse.candidates[0].content.parts.length > 0) {
      const textoGerado = jsonResponse.candidates[0].content.parts[0].text;
      const resultado = JSON.parse(textoGerado);
      
      // Valida se retornou null ou objeto com datas
      if (resultado === null) {
        return null;
      }
      if (resultado.inicio && resultado.fim) {
        return resultado;
      }
    }
    
    return null;
    
  } catch (erro) {
    if (isGeminiRateLimitError_(erro)) {
      notificarRateLimitGemini_("Parser de datas do Calendar");
      throw erro;
    }
    Logger.log("[ORGANIZADOR] Erro ao processar data com Gemini: " + erro.toString());
    return null;
  }
}

// ==================== INTEGRAÇÃO GOOGLE CALENDAR ====================

/**
 * Envia eventos para o Google Calendar.
 * @param {Array} eventos Array de objetos {titulo, data_sugerida}.
 * @return {number} Número de eventos criados.
 */
function enviarEventosParaCalendar(eventos) {
  if (!eventos || eventos.length === 0) {
    return 0;
  }
  
  let contador = 0;
  const calendarioId = 'primary';
  const hoje = Utilities.formatDate(new Date(), "GMT-3", "yyyy-MM-dd");
  
  eventos.forEach(evento => {
    try {
      let eventoCalendar;
      
      // Usa datas já extraídas pelo Cerebro (otimizado)
      if (evento.data_inicio && evento.data_fim) {
        eventoCalendar = {
          summary: evento.titulo,
          description: "Data original: " + (evento.data_sugerida_original || evento.data_sugerida || ""),
          start: { date: evento.data_inicio },
          end: { date: evento.data_fim }
        };
      } else {
        // Fallback: tenta extrair com IA se não veio estruturado
        const textoData = evento.data_sugerida_original || evento.data_sugerida;
        if (textoData) {
          const datasExtraidas = extrairDataComIA(textoData);
          
          if (datasExtraidas && datasExtraidas.inicio) {
            eventoCalendar = {
              summary: evento.titulo,
              description: "Data original: " + textoData,
              start: { date: datasExtraidas.inicio },
              end: { date: datasExtraidas.fim }
            };
          }
        }
        
        // Se ainda não tem data, cria evento para ajustar manualmente
        if (!eventoCalendar) {
          eventoCalendar = {
            summary: evento.titulo + " (ajustar data)",
            description: "⚠️ Ajustar data manualmente: " + (textoData || "sem data"),
            start: { date: hoje },
            end: { date: hoje }
          };
        }
      }
      
      Calendar.Events.insert(eventoCalendar, calendarioId);
      contador++;
      Logger.log("[ORGANIZADOR] Evento criado: " + evento.titulo);
      
    } catch (erro) {
      if (isGeminiRateLimitError_(erro)) {
        throw erro;
      }
      Logger.log("[ORGANIZADOR] Erro ao criar evento '" + evento.titulo + "': " + erro.toString());
    }
  });
  
  return contador;
}

// ==================== SALVAMENTO DE NOTAS LIVRES ====================

/**
 * Sanitiza nome de arquivo removendo caracteres inválidos.
 * @param {string} nome Nome original.
 * @return {string} Nome sanitizado.
 */
function sanitizarNomeArquivo(nome) {
  return nome.replace(/[\/\\:*?"<>|]/g, '-').trim();
}

/**
 * Salva notas livres agrupadas por categoria na pasta GENERAL_NOTES.
 * @param {Array} notas Array de objetos {titulo, conteudo, categoria}.
 * @return {number} Número de notas salvas.
 */
function salvarNotasLivres(notas) {
  if (!notas || notas.length === 0) {
    return 0;
  }
  
  let contador = 0;
  const config = getConfig_();
  
  // Validação de pasta
  let pastaNotas;
  try {
    pastaNotas = DriveApp.getFolderById(config.GENERAL_NOTES_FOLDER_ID);
  } catch (erro) {
    Logger.log("[ORGANIZADOR] Erro: GENERAL_NOTES_FOLDER_ID inválido: " + config.GENERAL_NOTES_FOLDER_ID);
    throw erro;
  }
  
  const timestamp = Utilities.formatDate(new Date(), "GMT-3", "yyyy-MM-dd HH:mm");
  
  // Agrupa notas por categoria
  const notasPorCategoria = {};
  notas.forEach(nota => {
    const categoria = (nota.categoria || 'ideias').toLowerCase();
    if (!notasPorCategoria[categoria]) {
      notasPorCategoria[categoria] = [];
    }
    notasPorCategoria[categoria].push(nota);
  });
  
  // Salva em arquivo por categoria
  Object.keys(notasPorCategoria).forEach(categoria => {
    try {
      const nomeArquivoBase = categoria.charAt(0).toUpperCase() + categoria.slice(1) + '.md';
      const nomeArquivo = sanitizarNomeArquivo(nomeArquivoBase);
      const notasDaCategoria = notasPorCategoria[categoria];
      
      // Tenta buscar arquivo existente
      const arquivosExistentes = pastaNotas.getFilesByName(nomeArquivo);
      let arquivo;
      let conteudoAtual = '';
      
      if (arquivosExistentes.hasNext()) {
        arquivo = arquivosExistentes.next();
        conteudoAtual = arquivo.getBlob().getDataAsString();
      }
      
      // Adiciona novas entradas
      let novoConteudo = conteudoAtual;
      if (!novoConteudo) {
        novoConteudo = `# ${categoria.charAt(0).toUpperCase() + categoria.slice(1)}\n\n`;
      }
      
      novoConteudo += `\n---\n## [${timestamp}]\n\n`;
      notasDaCategoria.forEach(nota => {
        novoConteudo += `### ${nota.titulo}\n\n${nota.conteudo}\n\n`;
        // Adiciona tags sugeridas se existirem
        if (nota.tags_sugeridas && nota.tags_sugeridas.length > 0) {
          const tags = nota.tags_sugeridas
            .map(tag => String(tag || '').trim())
            .filter(tag => tag)
            .map(tag => tag.startsWith('#') ? tag : `#${tag}`)
            .join(' ');

          if (tags) {
          novoConteudo += `**Tags:** ${tags}\n\n`;
          }
        }
        contador++;
      });
      
      // Salva ou atualiza arquivo
      if (arquivo) {
        arquivo.setContent(novoConteudo);
        Logger.log("[ORGANIZADOR] Atualizado " + nomeArquivo + " (+ " + notasDaCategoria.length + " nota(s))");
      } else {
        pastaNotas.createFile(nomeArquivo, novoConteudo, MimeType.PLAIN_TEXT);
        Logger.log("[ORGANIZADOR] Criado " + nomeArquivo + " com " + notasDaCategoria.length + " nota(s)");
      }
      
    } catch (erro) {
      Logger.log("[ORGANIZADOR] Erro ao salvar categoria '" + categoria + "': " + erro.toString());
    }
  });
  
  return contador;
}

// ==================== RESUMO DIÁRIO (TELEGRAM) ====================

function gerarResumoDiaHoje_() {
  const dataAtual = new Date();
  const dataIso = Utilities.formatDate(dataAtual, "GMT-3", "yyyy-MM-dd");
  const dataBr = Utilities.formatDate(dataAtual, "GMT-3", "dd/MM/yyyy");
  const fraseInspiradora = obterFraseInspiradoraDoDia_();

  const compromissos = listarCompromissosDoDia_();
  const tarefas = listarTarefasHojeEAtrasadas_();
  const resumoMarkdown = montarResumoDiaMarkdown_(dataIso, dataBr, fraseInspiradora, compromissos, tarefas);
  const resumoTelegram = montarResumoDiaTelegram_(dataBr, fraseInspiradora, compromissos, tarefas);
  const tagsResumo = ["#dailynote", "#resumo-dia", "#agenda", "#tarefas"];

  salvarResumoDiarioNoDrive_(dataIso, resumoMarkdown, tagsResumo);

  return {
    dataIso: dataIso,
    dataBr: dataBr,
    totalCompromissos: compromissos.length,
    totalTarefas: tarefas.length,
    resumoMarkdown: resumoMarkdown,
    resumoTelegram: resumoTelegram
  };
}

function gerarResumoSemanaAtual_() {
  const intervalo = obterIntervaloSemanaAtual_();
  const dataIsoInicio = Utilities.formatDate(intervalo.inicio, "GMT-3", "yyyy-MM-dd");
  const dataIsoFim = Utilities.formatDate(new Date(intervalo.fim.getTime() - 1), "GMT-3", "yyyy-MM-dd");
  const dataBrInicio = Utilities.formatDate(intervalo.inicio, "GMT-3", "dd/MM/yyyy");
  const dataBrFim = Utilities.formatDate(new Date(intervalo.fim.getTime() - 1), "GMT-3", "dd/MM/yyyy");
  const fraseInspiradora = obterFraseInspiradoraDoDia_();

  const compromissos = listarCompromissosNoIntervalo_(intervalo, 'RESUMO-SEMANA');
  const tarefas = listarTarefasSemanaEAtrasadas_(intervalo);
  const resumoMarkdown = montarResumoSemanaMarkdown_(dataIsoInicio, dataIsoFim, dataBrInicio, dataBrFim, fraseInspiradora, compromissos, tarefas);
  const resumoTelegram = montarResumoSemanaTelegram_(dataBrInicio, dataBrFim, fraseInspiradora, compromissos, tarefas);
  const tagsResumo = ["#weeklynote", "#resumo-semana", "#agenda", "#tarefas"];

  salvarResumoSemanalNoDrive_(dataIsoInicio, dataIsoFim, resumoMarkdown, tagsResumo);

  return {
    dataIsoInicio: dataIsoInicio,
    dataIsoFim: dataIsoFim,
    dataBrInicio: dataBrInicio,
    dataBrFim: dataBrFim,
    totalCompromissos: compromissos.length,
    totalTarefas: tarefas.length,
    resumoMarkdown: resumoMarkdown,
    resumoTelegram: resumoTelegram
  };
}

function listarCompromissosDoDia_() {
  const intervalo = obterIntervaloHoje_();
  return listarCompromissosNoIntervalo_(intervalo, 'RESUMO-DIA');
}

function listarCompromissosNoIntervalo_(intervalo, contextoLog) {
  const eventosAgregados = [];
  let paginaCalendarios;

  do {
    const respostaCalendarios = Calendar.CalendarList.list({
      pageToken: paginaCalendarios,
      showDeleted: false,
      showHidden: false,
      maxResults: 250
    });

    const calendarios = respostaCalendarios.items || [];

    calendarios.forEach(calendario => {
      if (!calendario || !calendario.id) {
        return;
      }

      try {
        let paginaEventos;
        do {
          const response = Calendar.Events.list(calendario.id, {
            timeMin: intervalo.inicio.toISOString(),
            timeMax: intervalo.fim.toISOString(),
            singleEvents: true,
            orderBy: 'startTime',
            maxResults: 250,
            pageToken: paginaEventos
          });

          const eventos = response.items || [];
          eventos.forEach(evento => {
            eventosAgregados.push({
              titulo: evento.summary || 'Sem título',
              horario: formatarHorarioEvento_(evento),
              diaTodo: !!(evento.start && evento.start.date && !evento.start.dateTime),
              _ordem: (evento.start && (evento.start.dateTime || evento.start.date)) || ''
            });
          });

          paginaEventos = response.nextPageToken;
        } while (paginaEventos);
      } catch (erro) {
        Logger.log('[' + contextoLog + '] Não foi possível listar eventos do calendário ' + calendario.id + ': ' + erro.toString());
      }
    });

    paginaCalendarios = respostaCalendarios.nextPageToken;
  } while (paginaCalendarios);

  return eventosAgregados
    .sort((a, b) => {
      const ordem = String(a._ordem || '').localeCompare(String(b._ordem || ''));
      if (ordem !== 0) {
        return ordem;
      }
      return String(a.titulo || '').localeCompare(String(b.titulo || ''));
    })
    .map(item => ({
      titulo: item.titulo,
      horario: item.horario,
      diaTodo: item.diaTodo
    }));
}

function listarTarefasHojeEAtrasadas_() {
  const hoje = Utilities.formatDate(new Date(), "GMT-3", "yyyy-MM-dd");
  const listaId = obterListaPadraoTasks();
  const response = Tasks.Tasks.list(listaId, {
    showCompleted: false,
    showHidden: false,
    maxResults: 100
  });

  const tarefas = response.items || [];

  return tarefas
    .filter(tarefa => !tarefa.completed)
    .map(tarefa => {
      const vencimento = tarefa.due
        ? Utilities.formatDate(new Date(tarefa.due), "GMT-3", "yyyy-MM-dd")
        : '';

      return {
        titulo: tarefa.title || 'Sem título',
        vencimento: vencimento,
        atrasada: !!(vencimento && vencimento < hoje)
      };
    })
    .filter(tarefa => tarefa.vencimento && tarefa.vencimento <= hoje)
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento));
}

function listarTarefasSemanaEAtrasadas_(intervalo) {
  const fimSemana = Utilities.formatDate(new Date(intervalo.fim.getTime() - 1), "GMT-3", "yyyy-MM-dd");
  const hoje = Utilities.formatDate(new Date(), "GMT-3", "yyyy-MM-dd");
  const listaId = obterListaPadraoTasks();
  const response = Tasks.Tasks.list(listaId, {
    showCompleted: false,
    showHidden: false,
    maxResults: 100
  });

  const tarefas = response.items || [];

  return tarefas
    .filter(tarefa => !tarefa.completed)
    .map(tarefa => {
      const vencimento = tarefa.due
        ? Utilities.formatDate(new Date(tarefa.due), "GMT-3", "yyyy-MM-dd")
        : '';

      return {
        titulo: tarefa.title || 'Sem título',
        vencimento: vencimento,
        atrasada: !!(vencimento && vencimento < hoje)
      };
    })
    .filter(tarefa => tarefa.vencimento && tarefa.vencimento <= fimSemana)
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento));
}

function montarResumoDiaTelegram_(dataBr, fraseInspiradora, compromissos, tarefas) {
  const linhas = [
    "📌 Resumo de hoje (" + dataBr + ")",
    "💡 " + fraseInspiradora,
    "",
    "📅 Compromissos"
  ];

  if (compromissos.length === 0) {
    linhas.push("- Nenhum compromisso para hoje.");
  } else {
    compromissos.forEach(item => {
      const horario = item.diaTodo ? "Dia todo" : item.horario;
      linhas.push("- " + horario + " · " + item.titulo);
    });
  }

  linhas.push("", "✅ Tarefas (hoje + atrasadas)");

  if (tarefas.length === 0) {
    linhas.push("- [ ] Nenhuma tarefa vencendo hoje ou atrasada.");
  } else {
    tarefas.forEach(item => {
      const marcador = item.atrasada ? "⚠️" : "🕘";
      const dataVencimento = item.vencimento.split('-').reverse().join('/');
      linhas.push("- [ ] " + marcador + " " + item.titulo + " (" + dataVencimento + ")");
    });
  }

  return linhas.join("\n");
}

function montarResumoDiaMarkdown_(dataIso, dataBr, fraseInspiradora, compromissos, tarefas) {
  const linhas = [
    "## " + dataIso,
    "",
    "> [!quote]- Reflexão para começar o dia",
    "> " + fraseInspiradora,
    "",
    "> [!info]- Agenda do dia (" + dataBr + ")"
  ];

  if (compromissos.length === 0) {
    linhas.push("> - Nenhum compromisso para hoje.");
  } else {
    compromissos.forEach(item => {
      const horario = item.diaTodo ? "Dia todo" : item.horario;
      linhas.push("> - **" + horario + "** — " + item.titulo);
    });
  }

  linhas.push("", "> [!warning] Tarefas (hoje + atrasadas)");

  if (tarefas.length === 0) {
    linhas.push("> - [ ] Nenhuma tarefa vencendo hoje ou atrasada.");
  } else {
    tarefas.forEach(item => {
      const status = item.atrasada ? "atrasada" : "vence hoje";
      const dataVencimento = item.vencimento.split('-').reverse().join('/');
      linhas.push("> - [ ] " + item.titulo + " — " + dataVencimento + " (" + status + ")");
    });
  }

  return linhas.join("\n");
}

function montarResumoSemanaTelegram_(dataBrInicio, dataBrFim, fraseInspiradora, compromissos, tarefas) {
  const linhas = [
    "📌 Resumo da semana (" + dataBrInicio + " a " + dataBrFim + ")",
    "💡 " + fraseInspiradora,
    "",
    "📅 Compromissos"
  ];

  if (compromissos.length === 0) {
    linhas.push("- Nenhum compromisso nesta semana.");
  } else {
    compromissos.forEach(item => {
      const horario = item.diaTodo ? "Dia todo" : item.horario;
      linhas.push("- " + horario + " · " + item.titulo);
    });
  }

  linhas.push("", "✅ Tarefas (semana + atrasadas)");

  if (tarefas.length === 0) {
    linhas.push("- [ ] Nenhuma tarefa para a semana ou atrasada.");
  } else {
    tarefas.forEach(item => {
      const marcador = item.atrasada ? "⚠️" : "🕘";
      const dataVencimento = item.vencimento.split('-').reverse().join('/');
      linhas.push("- [ ] " + marcador + " " + item.titulo + " (" + dataVencimento + ")");
    });
  }

  return linhas.join("\n");
}

function montarResumoSemanaMarkdown_(dataIsoInicio, dataIsoFim, dataBrInicio, dataBrFim, fraseInspiradora, compromissos, tarefas) {
  const linhas = [
    "## Semana " + dataIsoInicio + " a " + dataIsoFim,
    "",
    "> [!quote]- Reflexão para a semana",
    "> " + fraseInspiradora,
    "",
    "> [!info]- Agenda da semana (" + dataBrInicio + " a " + dataBrFim + ")"
  ];

  if (compromissos.length === 0) {
    linhas.push("> - Nenhum compromisso nesta semana.");
  } else {
    compromissos.forEach(item => {
      const horario = item.diaTodo ? "Dia todo" : item.horario;
      linhas.push("> - **" + horario + "** — " + item.titulo);
    });
  }

  linhas.push("", "> [!warning] Tarefas (semana + atrasadas)");

  if (tarefas.length === 0) {
    linhas.push("> - [ ] Nenhuma tarefa para a semana ou atrasada.");
  } else {
    tarefas.forEach(item => {
      const status = item.atrasada ? "atrasada" : "nesta semana";
      const dataVencimento = item.vencimento.split('-').reverse().join('/');
      linhas.push("> - [ ] " + item.titulo + " — " + dataVencimento + " (" + status + ")");
    });
  }

  return linhas.join("\n");
}

function salvarResumoDiarioNoDrive_(dataIso, conteudoMarkdown, tags) {
  const config = getConfig_();
  const pastaNotas = DriveApp.getFolderById(config.GENERAL_NOTES_FOLDER_ID);
  const nomeArquivo = dataIso + ".md";
  const tagsTexto = (tags || []).join(' ');
  const conteudoFinal = conteudoMarkdown + "\n\n" + tagsTexto + "\n";

  const arquivosExistentes = pastaNotas.getFilesByName(nomeArquivo);
  if (arquivosExistentes.hasNext()) {
    const arquivo = arquivosExistentes.next();
    arquivo.setContent(conteudoFinal);
    Logger.log("[ORGANIZADOR] Resumo diário atualizado: " + nomeArquivo);
    return;
  }

  pastaNotas.createFile(nomeArquivo, conteudoFinal, MimeType.PLAIN_TEXT);
  Logger.log("[ORGANIZADOR] Resumo diário criado: " + nomeArquivo);
}

function salvarResumoSemanalNoDrive_(dataIsoInicio, dataIsoFim, conteudoMarkdown, tags) {
  const config = getConfig_();
  const pastaNotas = DriveApp.getFolderById(config.GENERAL_NOTES_FOLDER_ID);
  const nomeArquivo = "semana-" + dataIsoInicio + "_" + dataIsoFim + ".md";
  const tagsTexto = (tags || []).join(' ');
  const conteudoFinal = conteudoMarkdown + "\n\n" + tagsTexto + "\n";

  const arquivosExistentes = pastaNotas.getFilesByName(nomeArquivo);
  if (arquivosExistentes.hasNext()) {
    const arquivo = arquivosExistentes.next();
    arquivo.setContent(conteudoFinal);
    Logger.log("[ORGANIZADOR] Resumo semanal atualizado: " + nomeArquivo);
    return;
  }

  pastaNotas.createFile(nomeArquivo, conteudoFinal, MimeType.PLAIN_TEXT);
  Logger.log("[ORGANIZADOR] Resumo semanal criado: " + nomeArquivo);
}

function obterFraseInspiradoraDoDia_() {
  const frases = [
    "Comece pequeno, mas comece com consistência.",
    "Seu foco de hoje constrói o resultado de amanhã.",
    "Progresso diário vale mais que perfeição ocasional.",
    "Uma tarefa de cada vez também é estratégia.",
    "Clareza nas prioridades transforma o dia.",
    "Disciplina leve e constante vence a pressa.",
    "O melhor momento para organizar o dia é agora.",
    "Feito com atenção é melhor que adiado por dúvida."
  ];

  const data = new Date();
  const inicioAno = new Date(data.getFullYear(), 0, 0);
  const diferenca = data - inicioAno;
  const diaDoAno = Math.floor(diferenca / 86400000);
  const indice = diaDoAno % frases.length;

  return frases[indice];
}

function obterIntervaloHoje_() {
  const inicio = new Date();
  inicio.setHours(0, 0, 0, 0);

  const fim = new Date(inicio);
  fim.setDate(fim.getDate() + 1);

  return { inicio: inicio, fim: fim };
}

function obterIntervaloSemanaAtual_() {
  const inicio = new Date();
  inicio.setHours(0, 0, 0, 0);

  const diaSemana = inicio.getDay();
  const diasDesdeSegunda = (diaSemana + 6) % 7;
  inicio.setDate(inicio.getDate() - diasDesdeSegunda);

  const fim = new Date(inicio);
  fim.setDate(fim.getDate() + 7);

  return { inicio: inicio, fim: fim };
}

function formatarHorarioEvento_(evento) {
  if (!evento || !evento.start) {
    return 'Sem horário';
  }

  if (evento.start.dateTime) {
    return Utilities.formatDate(new Date(evento.start.dateTime), "GMT-3", "HH:mm");
  }

  if (evento.start.date) {
    return 'Dia todo';
  }

  return 'Sem horário';
}

// ==================== DISTRIBUIDOR PRINCIPAL ====================

/**
 * Distribui dados extraídos para os serviços apropriados.
 * @param {Object} dadosEstruturados Objeto {tarefas, notas_livres, eventos}.
 * @param {string} arquivoId ID do arquivo original.
 * @return {Object} Objeto com contadores e erros.
 */
function distribuirDadosExtraidos(dadosEstruturados, arquivoId) {
  const resultado = {
    tarefasCriadas: 0,
    eventosCriados: 0,
    notasSalvas: 0,
    erros: []
  };
  
  try {
    // Processa tarefas
    if (dadosEstruturados.tarefas && dadosEstruturados.tarefas.length > 0) {
      try {
        resultado.tarefasCriadas = enviarTarefasParaTasks(dadosEstruturados.tarefas);
      } catch (erro) {
        resultado.erros.push("Tasks: " + erro.toString());
      }
    }
    
    // Processa eventos
    if (dadosEstruturados.eventos && dadosEstruturados.eventos.length > 0) {
      try {
        resultado.eventosCriados = enviarEventosParaCalendar(dadosEstruturados.eventos);
      } catch (erro) {
        if (isGeminiRateLimitError_(erro)) {
          throw erro;
        }
        resultado.erros.push("Calendar: " + erro.toString());
      }
    }
    
    // Processa notas livres
    if (dadosEstruturados.notas_livres && dadosEstruturados.notas_livres.length > 0) {
      try {
        resultado.notasSalvas = salvarNotasLivres(dadosEstruturados.notas_livres);
      } catch (erro) {
        resultado.erros.push("Notas: " + erro.toString());
      }
    }
    
  } catch (erro) {
    Logger.log("[ORGANIZADOR] Erro geral na distribuição: " + erro.toString());
    resultado.erros.push("Geral: " + erro.toString());
  }
  
  return resultado;
}

// ==================== ORQUESTRADOR PRINCIPAL ====================

/**
 * Processa todos os arquivos Markdown não processados.
 * @return {Object} Resumo do processamento.
 */
function processarArquivosMarkdown() {
  Logger.log("[ORGANIZADOR] Iniciando processamento de arquivos...");
  
  const config = getConfig_();
  const resumo = {
    arquivosProcessados: 0,
    totalTarefas: 0,
    totalEventos: 0,
    totalNotas: 0,
    erros: [],
    arquivosRestantes: 0
  };
  
  try {
    const arquivos = listarNovosArquivosMarkdown();

    if (arquivos.length === 0) {
      Logger.log("[ORGANIZADOR] Nenhum arquivo novo encontrado.");
      return resumo;
    }

    const maxBatch = config.MAX_ARQUIVOS_POR_BATCH;
    const arquivosParaProcessar = arquivos.slice(0, maxBatch);
    resumo.arquivosRestantes = Math.max(0, arquivos.length - maxBatch);

    Logger.log("[ORGANIZADOR] Encontrados " + arquivos.length + " arquivo(s). Processando " + arquivosParaProcessar.length + " neste batch (limite: " + maxBatch + ")");

    for (let i = 0; i < arquivosParaProcessar.length; i++) {
      const arquivo = arquivosParaProcessar[i];

      try {
        Logger.log("[ORGANIZADOR] Processando: " + arquivo.nome);
        const dadosEstruturados = extrairDadosComIA(arquivo.conteudo);

        if (!dadosEstruturados) {
          Logger.log("[ORGANIZADOR] Falha ao extrair dados de: " + arquivo.nome);
          resumo.erros.push(arquivo.nome + ": Extração falhou");
          continue;
        }

        const resultado = distribuirDadosExtraidos(dadosEstruturados, arquivo.id);

        resumo.totalTarefas += resultado.tarefasCriadas;
        resumo.totalEventos += resultado.eventosCriados;
        resumo.totalNotas += resultado.notasSalvas;

        if (resultado.erros.length > 0) {
          resumo.erros.push(arquivo.nome + ": " + resultado.erros.join(", "));
        }

        moverParaProcessados(arquivo.id);
        resumo.arquivosProcessados++;
      } catch (erro) {
        if (isGeminiRateLimitError_(erro)) {
          const msgRate = "Rate limit Gemini durante processamento em lote";
          Logger.log("[ORGANIZADOR] " + msgRate + ". Interrompendo execução.");
          resumo.erros.push(arquivo.nome + ": " + msgRate);
          resumo.arquivosRestantes += (arquivosParaProcessar.length - i - 1);
          notificarRateLimitGemini_("Processamento em lote");
          break;
        }

        Logger.log("[ORGANIZADOR] Erro ao processar '" + arquivo.nome + "': " + erro.toString());
        resumo.erros.push(arquivo.nome + ": " + erro.toString());
      }
    }
    
    // Log do resumo
    Logger.log("[ORGANIZADOR] === RESUMO DO PROCESSAMENTO ===");
    Logger.log("[ORGANIZADOR] Arquivos processados: " + resumo.arquivosProcessados);
    Logger.log("[ORGANIZADOR] Tarefas criadas: " + resumo.totalTarefas);
    Logger.log("[ORGANIZADOR] Eventos criados: " + resumo.totalEventos);
    Logger.log("[ORGANIZADOR] Notas salvas: " + resumo.totalNotas);
    if (resumo.arquivosRestantes > 0) {
      Logger.log("[ORGANIZADOR] Arquivos restantes (próximo batch): " + resumo.arquivosRestantes);
    }
    if (resumo.erros.length > 0) {
      Logger.log("[ORGANIZADOR] Erros: " + resumo.erros.length);
    }
    
  } catch (erro) {
    Logger.log("[ORGANIZADOR] Erro crítico no orquestrador: " + erro.toString());
    resumo.erros.push("Crítico: " + erro.toString());
  }
  
  return resumo;
}

// ==================== TRIGGERS AUTOMÁTICOS ====================

/**
 * Configura trigger automático para processar arquivos 1x ao dia.
 * Hora padrão: 7h15 (pode ser alterada em Script Properties com PROCESSAMENTO_DIARIO_HORA/MINUTO).
 */
function configurarTriggersAutomaticos() {
  const funcao = 'processarArquivosMarkdown';
  const props = PropertiesService.getScriptProperties();
  const horaConfigurada = Number(props.getProperty('PROCESSAMENTO_DIARIO_HORA') || '7');
  const minutoConfigurado = Number(props.getProperty('PROCESSAMENTO_DIARIO_MINUTO') || '15');
  const hora = Math.max(0, Math.min(23, horaConfigurada));
  const minuto = Math.max(0, Math.min(59, minutoConfigurado));
  
  try {
    const triggersExistentes = ScriptApp.getProjectTriggers();
    triggersExistentes.forEach(trigger => {
      if (trigger.getHandlerFunction() === funcao) {
        ScriptApp.deleteTrigger(trigger);
        Logger.log("[ORGANIZADOR] Trigger removido: " + trigger.getUniqueId());
      }
    });

    ScriptApp.newTrigger(funcao)
      .timeBased()
      .atHour(hora)
      .nearMinute(minuto)
      .everyDays(1)
      .create();

    Logger.log("[ORGANIZADOR] ✅ Trigger diário configurado com sucesso!");
    Logger.log("[ORGANIZADOR] Horário diário aproximado: " + hora + "h" + (minuto < 10 ? "0" : "") + minuto);
    Logger.log("[ORGANIZADOR] Dica: para reset de cota do Pacífico, use 04:15 ou 05:15 (São Paulo, conforme DST)");
    Logger.log("[ORGANIZADOR] Execução manual continua disponível via comando /processar");
  
  } catch (erro) {
    Logger.log("[ORGANIZADOR] Erro ao configurar trigger diário: " + erro.toString());
    throw erro;
  }
}

/**
 * Lista os triggers atuais de processamento sem alterar nada.
 * @return {Array} Lista de objetos com função e origem do trigger.
 */
function listarTriggersProcessamento() {
  const funcao = 'processarArquivosMarkdown';
  const triggers = ScriptApp.getProjectTriggers();

  const resultado = triggers
    .filter(trigger => trigger.getHandlerFunction() === funcao)
    .map(trigger => ({
      handler: trigger.getHandlerFunction(),
      source: String(trigger.getTriggerSource()),
      eventType: String(trigger.getEventType()),
      id: trigger.getUniqueId()
    }));

  Logger.log('[ORGANIZADOR] Triggers de processamento encontrados: ' + resultado.length);
  resultado.forEach(item => {
    Logger.log('[ORGANIZADOR] triggerId=' + item.id + ' | source=' + item.source + ' | eventType=' + item.eventType);
  });

  return resultado;
}

// ==================== TESTES ====================

function testarIntegracaoComIA() {
  // 1. Aciona o Scanner
  const arquivos = listarNovosArquivosMarkdown();
  
  if (arquivos.length === 0) {
    Logger.log("Nenhum arquivo encontrado na pasta.");
    return;
  }

  // 2. Isolamos apenas o primeiro arquivo para o teste
  const arquivoDeTeste = arquivos[0];
  Logger.log("Testando a extração no arquivo: " + arquivoDeTeste.nome);
  Logger.log("Conteúdo original sendo enviado para a IA:\n" + arquivoDeTeste.conteudo);
  Logger.log("Aguardando processamento do Gemini...");

  // 3. Enviamos para a IA processar
  const dadosEstruturados = extrairDadosComIA(arquivoDeTeste.conteudo);

  // 4. Validamos o retorno
  if (dadosEstruturados) {
    Logger.log("SUCESSO! JSON retornado pela IA:");
    // O JSON.stringify com 'null, 2' deixa o log formatado e bonito de ler
    Logger.log(JSON.stringify(dadosEstruturados, null, 2)); 
  } else {
    Logger.log("FALHA: A IA não retornou os dados ou houve um erro de conexão.");
  }
}