FROM node:20-alpine

# Directorio de trabajo
WORKDIR /app

# Instalar dependencias primero (cache de Docker)
COPY package*.json ./
RUN npm ci --omit=dev

# Copiar código fuente
COPY . .

# Crear carpeta uploads
RUN mkdir -p uploads

# Puerto expuesto
EXPOSE 8080

# Variables de entorno por defecto
ENV PORT=8080
ENV DATABASE_PATH=/data/facturas.db

CMD ["node", "server.js"]
