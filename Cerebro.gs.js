/**
 * Envia o texto do Markdown para o Gemini e retorna um objeto estruturado.
 * @param {string} textoMarkdown O conteúdo lido do arquivo.
 * @return {Object|null} JSON com tarefas, notas e eventos, ou null em caso de erro.
 */
function extrairDadosComIA(textoMarkdown) {
  const config = getConfig_();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.MODELO_IA}:generateContent?key=${config.GEMINI_API_KEY}`;
  
  const prompt = `Você é um assistente de produtividade. Leia a transcrição abaixo e extraia as informações estruturadas.
  Retorne APENAS um JSON válido com o seguinte formato exato (deixe os arrays vazios se não houver dados correspondentes):
  {
    "tarefas": [{"titulo": "Resumo da tarefa", "detalhes": "Contexto adicional"}],
    "notas_livres": [{"titulo": "Tema da nota", "conteudo": "Anotações e ideias"}],
    "eventos": [{"titulo": "Nome do evento", "data_sugerida": "Contexto de data/hora"}]
  }
  
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
    const response = UrlFetchApp.fetch(url, options);
    const jsonResponse = JSON.parse(response.getContentText());
    
    // Extrai a resposta da IA
    if (jsonResponse.candidates && jsonResponse.candidates.length > 0) {
      const textoGerado = jsonResponse.candidates[0].content.parts[0].text;
      return JSON.parse(textoGerado);
    } else {
      Logger.log("Erro na estrutura de resposta do Gemini: " + response.getContentText());
      return null;
    }
    
  } catch (erro) {
    Logger.log("Erro ao processar com Gemini: " + erro.toString());
    return null;
  }
}