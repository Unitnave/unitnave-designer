# 🚀 GUÍA RÁPIDA DE INICIO - UNITNAVE

## Pablo, sigue estos pasos EXACTOS:

### ✅ PASO 1: Descargar todo el código (YA HECHO)
El código está en: `/home/claude/`
- Backend: `/home/claude/backend/`
- Frontend: `/home/claude/frontend/`
- Documentación: `/home/claude/README.md`

---

### ✅ PASO 2: Probar localmente (OPCIONAL, si quieres ver antes de subir)

#### Opción A: Solo ver el código
- Ya está todo creado
- Puedes leer los archivos
- Pasar directo al PASO 3

#### Opción B: Probar en tu PC
```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload

# Frontend (en otra terminal)
cd frontend
npm install
npm run dev
```

Abre: `http://localhost:3000`

---

### ✅ PASO 3: Subir a Railway (PRINCIPAL)

#### 3.1 - Registrarte en Railway

1. Ve a: https://railway.app
2. Click "Start a New Project"
3. **Regístrate con tu EMAIL** (tu email de Isolan)
4. **NO añadas tarjeta todavía**

#### 3.2 - Subir el Backend

**OPCIÓN FÁCIL (sin GitHub):**

1. En Railway, click "Deploy from GitHub"
2. Si no tienes GitHub, click "Deploy from local directory"
3. Railway te pedirá instalar el CLI:
   ```bash
   # Windows (PowerShell):
   iwr https://railway.app/install.ps1 | iex
   
   # Mac/Linux:
   curl -fsSL https://railway.app/install.sh | sh
   ```

4. Ir a la carpeta backend:
   ```bash
   cd backend
   railway login
   railway init
   railway up
   ```

5. Railway detectará el Dockerfile y lo desplegará automáticamente

**OPCIÓN MEJOR (con GitHub):**

1. Crea cuenta en GitHub: https://github.com/signup
2. Crea un nuevo repositorio
3. Sube el código:
   ```bash
   git init
   git add .
   git commit -m "UNITNAVE Designer"
   git remote add origin https://github.com/TU_USUARIO/unitnave-designer.git
   git push -u origin main
   ```
4. En Railway: "Deploy from GitHub repo"
5. Selecciona tu repositorio
6. Selecciona carpeta: `backend`
7. Click "Deploy"

#### 3.3 - Añadir Base de Datos

1. En el proyecto de Railway, click "+ New"
2. Selecciona "Database" → "PostgreSQL"
3. Railway lo conectará automáticamente al backend
4. **No necesitas configurar nada más**

#### 3.4 - Obtener URL del Backend

1. Ve al servicio "backend" en Railway
2. Pestaña "Settings" → "Domains"
3. Railway generó una URL automática
4. Cópiala (ej: `https://unitnave-backend-production.up.railway.app`)

#### 3.5 - Subir el Frontend

1. En Railway, mismo proyecto, click "+ New"
2. "Deploy from GitHub" (o local)
3. Selecciona carpeta: `frontend`
4. Antes de deployar, añade variable de entorno:
   ```
   VITE_API_URL=https://[URL-BACKEND-DEL-PASO-3.4]
   ```
5. Click "Deploy"

#### 3.6 - Obtener URL del Frontend

1. Ve al servicio "frontend"
2. Settings → Domains
3. Copia la URL (ej: `https://unitnave-frontend-production.up.railway.app`)

#### 3.7 - ¡YA ESTÁ FUNCIONANDO! 🎉

Abre la URL del frontend en tu navegador.

---

### ✅ PASO 4: Activar Plan PRO

**Solo cuando ya funcione y estés contento:**

1. En Railway, click en tu avatar (arriba derecha)
2. "Account Settings"
3. "Upgrade to Pro" ($20/mes)
4. Añadir tarjeta

**Beneficios PRO:**
- 32 GB RAM (necesario para Blender)
- 100+ renders/mes incluidos
- Mejor rendimiento

---

### ✅ PASO 5: Conectar tu dominio unitnave.com (OPCIONAL)

1. En Railway, servicio frontend → Settings → Domains
2. Click "Custom Domain"
3. Añade: `designer.unitnave.com`
4. Railway te dará un registro CNAME
5. En tu panel de DNS (donde gestionas unitnave.com):
   ```
   Tipo: CNAME
   Nombre: designer
   Valor: [el que te dio Railway]
   TTL: 3600
   ```
6. Espera 5-30 minutos para propagación

**Resultado:** `https://designer.unitnave.com` 🚀

---

## 🎯 RESUMEN RÁPIDO

```
1. Registrarte Railway → https://railway.app
2. Subir backend (carpeta /backend)
3. Añadir PostgreSQL
4. Subir frontend (carpeta /frontend) con VITE_API_URL
5. Probar la aplicación
6. Upgrade a PRO ($20/mes)
7. Conectar dominio (opcional)
```

---

## ❓ Si Algo No Funciona

### Backend no arranca
```bash
# Ver logs en Railway
railway logs
```

### Frontend no conecta
- Verificar VITE_API_URL en variables de entorno
- Debe apuntar al backend de Railway

### Renders fallan
- Upgrade a plan PRO (necesita más RAM para Blender)

---

## 📞 CONTACTO

Si te atascas en cualquier paso:
- Railway Discord: https://discord.gg/railway
- Documentación Railway: https://docs.railway.app

---

## 🎉 PRÓXIMOS PASOS (después de tenerlo funcionando)

1. ✅ Diseñar tu primera nave de prueba
2. ✅ Solicitar primer render profesional
3. ✅ Exportar PDF
4. ✅ Compartir con equipo Isolan
5. ✅ Añadir enlace en unitnave.com → "Diseña tu nave"
6. ✅ ¡Empezar a captar leads!

---

**¡El sistema está completo y listo para desplegar! 🏭🎨**
