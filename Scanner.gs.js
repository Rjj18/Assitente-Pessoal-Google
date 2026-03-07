/**
 * Busca arquivos Markdown na pasta definida por FOLDER_ID.
 * @return {Array} Lista de objetos com id, nome e conteúdo dos arquivos.
 */
function listarNovosArquivosMarkdown() {
  const config = getConfig_();
  const listaDeProcessamento = [];

  try {
    const pastaEntrada = DriveApp.getFolderById(config.FOLDER_ID);
    const arquivos = pastaEntrada.getFilesByType(MimeType.PLAIN_TEXT);
    
    while (arquivos.hasNext()) {
      const arquivo = arquivos.next();
      
      if (arquivo.getName().toLowerCase().endsWith('.md')) {
        try {
          listaDeProcessamento.push({
            id: arquivo.getId(),
            nome: arquivo.getName(),
            conteudo: arquivo.getBlob().getDataAsString()
          });
        } catch (erroArquivo) {
          Logger.log("Erro ao ler arquivo " + arquivo.getName() + ": " + erroArquivo.toString());
        }
      }
    }
    
    Logger.log('Arquivos .md encontrados: ' + listaDeProcessamento.length);
  } catch (erro) {
    Logger.log("Erro ao listar arquivos na pasta: " + erro.toString());
  }
  
  return listaDeProcessamento;
}