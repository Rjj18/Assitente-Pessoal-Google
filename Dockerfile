# Usa a versão LTS mais leve do Node.js
FROM node:lts-alpine

# Define o diretório de trabalho
WORKDIR /workspace

# Instala o Clasp e os types do Apps Script (para o VS Code dar autocompletar)
RUN npm install -g @google/clasp @types/google-apps-script

# Mantém o container vivo em background para podermos entrar e rodar comandos
CMD ["tail", "-f", "/dev/null"]