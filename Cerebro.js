/**
 * Envia o texto do Markdown para o Gemini e retorna um objeto estruturado.
 * @param {string} textoMarkdown O conteúdo lido do arquivo.
 * @return {Object|null} JSON com tarefas, notas e eventos, ou null em caso de erro.
 */
function extrairDadosComIA(textoMarkdown) {
  const config = getConfig_();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.MODELO_IA}:generateContent?key=${config.GEMINI_API_KEY}`;
  
  const dataAtual = Utilities.formatDate(new Date(), "GMT-3", "yyyy-MM-dd");
  const horaAtual = Utilities.formatDate(new Date(), "GMT-3", "HH:mm");
  
  const prompt = `Você é um assistente de produtividade. Hoje é ${dataAtual} às ${horaAtual}.
Leia a captura em Markdown abaixo e extraia apenas informações estruturadas realmente suportadas pelo texto.

Retorne APENAS um JSON válido e puro, sem blocos de código Markdown (\`\`\`json). O formato exato deve ser este (deixe os arrays vazios se não houver dados):
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
      "tags_sugeridas": ["#tag1", "#tag2"]
    }
  ],
  "eventos": [
    {
      "titulo": "Nome do evento",
      "data_inicio": "YYYY-MM-DD ou null",
      "hora_inicio": "HH:mm ou null",
      "data_fim": "YYYY-MM-DD ou null",
      "hora_fim": "HH:mm ou null",
      "data_sugerida_original": "Texto original da data e hora"
    }
  ]
}

REGRAS PARA TAREFAS:
Extraia APENAS se houver sinal explícito de compromisso:
- "preciso", "tenho que", "vou", "não posso esquecer", "me lembra de"
- Itens listados claramente como pendências.
- Checklists ou bullets com ação objetiva e executável.
Nunca extraia: verbos sem dono ("a gente resolve"), ideias hipotéticas ("seria legal"), ou planos vagos sem dono/prazo.
Se houver dúvida entre nota e tarefa, prefira nota.

REGRAS PARA NOTAS:
- Categorize estritamente em uma das 5 opções definidas.
- "work_routine" refere-se ao mapeamento das atividades diárias de trabalho.
- Gere até 3 "tags_sugeridas" relevantes para indexação em sistemas PKM.
- Preserve conteúdo factual e útil para consulta posterior; não resuma em excesso.

REGRAS PARA EVENTOS:
- Converta expressões ("amanhã", "próxima sexta às 15h") para os campos de data e hora corretos.
- Se o ano não for dito, presuma o ano atual.
- Se não identificar data/hora exata, use null.
- Só crie evento quando houver indício de compromisso agendável, reunião, consulta, viagem, visita, prazo com data, ou bloco temporal claro.
- Se existir data mas não houver hora, mantenha hora_inicio e hora_fim como null.

REGRAS GERAIS:
- Não invente dados ausentes.
- Remova duplicidades sem perder informação.
- Considere títulos e bullets da captura como sinais de prioridade, mas não como prova suficiente para criar tarefa ou evento sem conteúdo explícito.

Texto a ser analisado:
${textoMarkdown}`;

  const payload = {
    "contents": [{"parts": [{"text": prompt}]}],
    "generationConfig": {
        "responseMimeType": "application/json"
    }
  };

  const options = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };

  try {
    const jsonResponse = chamarGeminiJson_(url, payload, "extrairDadosComIA");
    if (!jsonResponse) {
      return null;
    }
    
    if (jsonResponse.error) {
      Logger.log("Erro na API Gemini: " + jsonResponse.error.message);
      return null;
    }
    
    // Extrai a resposta da IA
    if (jsonResponse.candidates && jsonResponse.candidates.length > 0 && jsonResponse.candidates[0].content && jsonResponse.candidates[0].content.parts && jsonResponse.candidates[0].content.parts.length > 0) {
      const textoGerado = jsonResponse.candidates[0].content.parts[0].text;
      return JSON.parse(textoGerado);
    } else {
      Logger.log("Erro na estrutura de resposta do Gemini: estrutura inesperada");
      return null;
    }
    
  } catch (erro) {
    if (isGeminiRateLimitError_(erro)) {
      notificarRateLimitGemini_("Extração de dados estruturados");
      throw erro;
    }
    Logger.log("Erro ao processar com Gemini: " + erro.toString());
    return null;
  }
}