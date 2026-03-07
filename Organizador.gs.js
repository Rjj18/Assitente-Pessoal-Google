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