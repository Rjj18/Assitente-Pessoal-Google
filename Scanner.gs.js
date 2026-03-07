/**
 * Busca arquivos Markdown na pasta definida por FOLDER_ID.
 * @return {Array} Lista de objetos com id, nome e conteúdo dos arquivos.
 */
function listarNovosArquivosMarkdown() {
  const config = getConfig_();
  const pastaEntrada = DriveApp.getFolderById(config.FOLDER_ID);
  const arquivos = pastaEntrada.getFilesByType(MimeType.PLAIN_TEXT); 
  const listaDeProcessamento = [];

  while (arquivos.hasNext()) {
    const arquivo = arquivos.next();
    
    if (arquivo.getName().toLowerCase().endsWith('.md')) {
      listaDeProcessamento.push({
        id: arquivo.getId(),
        nome: arquivo.getName(),
        conteudo: arquivo.getBlob().getDataAsString()
      });
    }
  }
  
  Logger.log('Arquivos .md encontrados: ' + listaDeProcessamento.length);
  return listaDeProcessamento;
}