# ============================================================
# Imagen de producción para el Generador de Cuentos Infantiles.
# Build en dos etapas: compila frontend + servidor, luego imagen ligera.
# ============================================================

# --- Etapa 1: build ---
FROM node:20-alpine AS build
WORKDIR /app

# Instala dependencias (incluye devDeps para poder compilar).
COPY package*.json ./
RUN npm ci

# Copia el código y construye frontend (dist/) + servidor (server.js).
COPY . .
RUN npm run build

# Elimina devDependencies para la imagen final.
RUN npm prune --omit=dev

# --- Etapa 2: runtime ---
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Copia solo lo necesario para ejecutar.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server.js ./server.js
COPY --from=build /app/package.json ./package.json

# El puerto lo define la plataforma; por defecto 3000.
ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
