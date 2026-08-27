# 🚀 Despliegue en Hostinger

Esta app es **full‑stack**: un frontend (React + Vite) servido por un backend
Node/Express (`server.ts`). El backend es imprescindible porque guarda de
forma segura la `GEMINI_API_KEY`, gestiona el OAuth de YouTube y el login.

> ⚠️ **No sirve un hosting compartido "solo estático"**. Necesitas un entorno
> que ejecute **Node.js**. En Hostinger tienes dos opciones válidas:
> **VPS** (recomendado, control total) o el **Node.js web app hosting** gestionado.

## 📦 Cómo se construye y arranca

```bash
npm install        # instala dependencias
npm run build      # compila el frontend (dist/) y empaqueta el server (server.js)
npm start          # arranca: node server.js  (sirve dist/ + la API)
```

- `npm run build` = `vite build` (genera `dist/`) + `build:server`
  (empaqueta `server.ts` → `server.js` con esbuild).
- `npm start` ejecuta `node server.js`, que sirve el frontend y expone `/api/*`.
- El puerto se toma de `process.env.PORT` (lo asigna Hostinger) o 3000.

## 🔑 Variables de entorno

Configúralas en el panel de Hostinger (o en un archivo `.env`; ver `.env.example`):

| Variable | Obligatoria | Para qué |
|---|---|---|
| `GEMINI_API_KEY` | ✅ | Generar cuento, imágenes, voces y metadata |
| `APP_URL` | ✅ (para OAuth) | URL pública; base de los callbacks OAuth |
| `PORT` | según plan | Puerto del servidor |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | opcional | Subida directa a YouTube |
| `META_APP_ID` / `META_APP_SECRET` | opcional | Facebook / Instagram |

---

## Opción A — VPS de Hostinger (recomendada)

1. **Crea el VPS** (Ubuntu) desde hPanel y conéctate por SSH.
2. **Instala Node.js 20+** (con nvm):
   ```bash
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
   nvm install 20
   ```
3. **Clona el repositorio y construye:**
   ```bash
   git clone https://github.com/LORDINFERNO999/Generador-de-cuentos-infantiles.git
   cd Generador-de-cuentos-infantiles
   npm install
   npm run build
   ```
4. **Crea el archivo `.env`** con tus claves (copia de `.env.example`).
5. **Arranca con PM2** (para que quede como servicio y reinicie solo):
   ```bash
   npm install -g pm2
   PORT=3000 pm2 start "npm start" --name cuentos
   pm2 save && pm2 startup
   ```
6. **Nginx como proxy inverso + dominio** (`/etc/nginx/sites-available/cuentos`):
   ```nginx
   server {
     server_name tu-dominio.com;
     client_max_body_size 30M;   # los videos/imágenes en base64 son grandes
     location / {
       proxy_pass http://127.0.0.1:3000;
       proxy_http_version 1.1;
       proxy_set_header Host $host;
       proxy_set_header X-Forwarded-Proto $scheme;
     }
   }
   ```
   ```bash
   ln -s /etc/nginx/sites-available/cuentos /etc/nginx/sites-enabled/
   nginx -t && systemctl reload nginx
   ```
7. **HTTPS gratis con Certbot** (obligatorio para OAuth, micrófono y compartir):
   ```bash
   apt install certbot python3-certbot-nginx -y
   certbot --nginx -d tu-dominio.com
   ```

Para actualizar: `git pull && npm install && npm run build && pm2 restart cuentos`.

---

## Opción B — Node.js web app hosting gestionado

1. En hPanel elige el hosting con Node.js y **crea la app** apuntando a este repo
   (o sube los archivos).
2. Configura:
   - **Comando de build:** `npm run build`
   - **Archivo de arranque / start:** `server.js` (o `npm start`)
   - **Versión de Node:** 20+
3. Añade las **variables de entorno** en el panel.
4. Despliega. Si el panel permite "deploy automático desde GitHub", conéctalo a
   la rama que quieras.

---

## 🔐 Configurar OAuth de YouTube (opcional)

1. En [Google Cloud Console](https://console.cloud.google.com): crea un proyecto,
   habilita **YouTube Data API v3** y crea credenciales **OAuth 2.0**.
2. Añade como **URI de redirección autorizada**:
   `https://tu-dominio.com/api/social/callback/youtube`
3. Pon `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` y `APP_URL` en el entorno.
4. Publica la pantalla de consentimiento (o añade tu cuenta como tester).

> Los videos se suben como **privados** y marcados para niños; revísalos en
> YouTube Studio antes de hacerlos públicos.

---

## ⚠️ Notas importantes

- **HTTPS es obligatorio** en producción: el OAuth, el micrófono (voces) y el
  Web Share API no funcionan sobre HTTP.
- El **login y la sincronización** usan un almacén **en memoria** (genérico, de
  desarrollo): los usuarios se pierden al reiniciar y no funciona con varias
  instancias. Antes de producción real, sustituye `src/server/authService.ts`
  por una base de datos (Hostinger ofrece MySQL) o un proveedor (Firebase,
  Supabase, Auth0).
- La **exportación de video** ocurre en el navegador del usuario (no carga el
  servidor). Las llamadas a Gemini (texto, imagen, voz) sí pasan por el backend.
- Sube `client_max_body_size` en Nginx (ya incluido: 30M) porque las imágenes y
  videos viajan en base64.


---

## 🐳 Opción C — Docker (VPS o cualquier contenedor)

El repo incluye un `Dockerfile` de producción (build en dos etapas).

```bash
# Construir la imagen
docker build -t cuentos .

# Ejecutar (pasa tus variables de entorno)
docker run -d --name cuentos -p 3000:3000 \
  -e GEMINI_API_KEY="tu_clave" \
  -e APP_URL="https://tu-dominio.com" \
  -e GOOGLE_CLIENT_ID="..." -e GOOGLE_CLIENT_SECRET="..." \
  cuentos
```

Detrás sigue conviniendo un Nginx con HTTPS (ver Opción A) apuntando a `:3000`.
