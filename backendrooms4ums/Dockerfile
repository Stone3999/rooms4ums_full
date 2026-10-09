# Etapa de construcción
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar el resto del código
COPY . .

# Compilar el proyecto
RUN npm run build

# Etapa de producción
FROM node:20-alpine

WORKDIR /app

# Copiar solo lo necesario desde el builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

# Exponer el puerto
EXPOSE 3000

# Comando para arrancar
CMD ["npm", "run", "start:prod"]
