# 🏭 UNITNAVE - Diseñador 3D de Naves Industriales

Sistema completo de diseño interactivo de naves industriales en 3D con renders profesionales mediante Blender.

![UNITNAVE Logo](https://unitnave.com/logo.svg)

## 🚀 Características

### Frontend (React + Three.js)
- ✅ Visualización 3D en tiempo real
- ✅ Interfaz drag & drop intuitiva
- ✅ Controles de cámara cinematográficos
- ✅ Vistas múltiples (3D, planta, exterior)
- ✅ Cálculos automáticos de capacidad
- ✅ Diseño responsive

### Backend (Python + FastAPI)
- ✅ API REST completa
- ✅ Cálculos de optimización de espacio
- ✅ Integración con Blender para renders fotorealistas
- ✅ Exportación a PDF
- ✅ Base de datos PostgreSQL
- ✅ Sistema de guardado de diseños

### Elementos Diseñables
- 📦 Estanterías industriales (convencionales, drive-in, cantilever)
- 🏢 Oficinas (una o dos plantas)
- 🚛 Muelles de carga
- 📐 Zonas de picking
- 🅿️ Áreas de circulación

---

## 📋 Requisitos Previos

### Para Desarrollo Local
- **Node.js** 18+ (para frontend)
- **Python** 3.11+ (para backend)
- **Blender** 4.0+ (para renders)
- **PostgreSQL** 15+ (opcional, para base de datos)

### Para Deploy en Railway
- Cuenta en [Railway.app](https://railway.app)
- Cuenta GitHub (recomendado para deploy automático)
- Presupuesto: $20-30/mes

---

## 🛠️ Instalación Local

### 1. Clonar el Repositorio

```bash
# Si tienes el código en GitHub
git clone https://github.com/tu-usuario/unitnave-designer.git
cd unitnave-designer

# Si tienes el ZIP
unzip unitnave-designer.zip
cd unitnave-designer
```

### 2. Backend (Python)

```bash
cd backend

# Crear entorno virtual
python -m venv venv

# Activar entorno virtual
# En Windows:
venv\Scripts\activate
# En Mac/Linux:
source venv/bin/activate

# Instalar dependencias
pip install -r requirements.txt

# Configurar variables de entorno
cp .env.example .env
# Edita .env con tus configuraciones

# Iniciar servidor
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

El backend estará en: `http://localhost:8000`
Documentación API: `http://localhost:8000/docs`

### 3. Frontend (React)

```bash
cd frontend

# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev
```

El frontend estará en: `http://localhost:3000`

---

## ☁️ Deploy en Railway (Paso a Paso)

### Paso 1: Preparar el Código

1. **Crear cuenta en Railway**
   - Ve a [railway.app](https://railway.app)
   - Regístrate con tu email o GitHub
   - No necesitas añadir tarjeta todavía

2. **Subir código a GitHub** (recomendado)
   
   Si no tienes GitHub:
   ```bash
   # Instalar Git si no lo tienes
   # Inicializar repositorio
   git init
   git add .
   git commit -m "Initial commit - UNITNAVE Designer"
   
   # Crear repo en GitHub y seguir instrucciones
   ```

### Paso 2: Deploy del Backend

1. **Crear nuevo proyecto en Railway**
   - Click en "New Project"
   - Selecciona "Deploy from GitHub repo"
   - Conecta tu repositorio de GitHub
   - Selecciona la carpeta `backend`

2. **Configurar variables de entorno**
   
   En Railway, ve a tu servicio → Variables:
   
   ```env
   PYTHONUNBUFFERED=1
   PORT=8000
   ALLOWED_ORIGINS=*
   ```

3. **Añadir base de datos PostgreSQL**
   - Click en "+ New" → Database → PostgreSQL
   - Railway generará automáticamente DATABASE_URL
   - Se conectará automáticamente al backend

4. **Configurar Blender**
   
   Crea archivo `Dockerfile` en `/backend`:
   
   ```dockerfile
   FROM python:3.11-slim

   # Instalar Blender
   RUN apt-get update && apt-get install -y \
       blender \
       && rm -rf /var/lib/apt/lists/*

   WORKDIR /app
   COPY requirements.txt .
   RUN pip install --no-cache-dir -r requirements.txt

   COPY . .

   CMD uvicorn main:app --host 0.0.0.0 --port $PORT
   ```

5. **Deploy**
   - Railway detectará el Dockerfile
   - Click "Deploy"
   - Espera 3-5 minutos

6. **Obtener URL del backend**
   - Railway generará una URL tipo: `https://tu-backend.up.railway.app`
   - Copia esta URL

### Paso 3: Deploy del Frontend

1. **Actualizar configuración del frontend**
   
   Crea `.env` en `/frontend`:
   
   ```env
   VITE_API_URL=https://tu-backend.up.railway.app
   ```

2. **Crear nuevo servicio en Railway**
   - En el mismo proyecto, click "+ New"
   - Deploy from GitHub repo
   - Selecciona carpeta `frontend`

3. **Configurar build**
   
   Railway debería detectar automáticamente, pero si no:
   
   ```
   Build Command: npm run build
   Start Command: npm run preview
   ```

4. **Deploy**
   - Click "Deploy"
   - Espera 2-3 minutos

5. **Obtener URL del frontend**
   - Railway generará URL: `https://tu-frontend.up.railway.app`
   - ¡Tu aplicación está ONLINE! 🎉

### Paso 4: Conectar Dominio Personalizado (Opcional)

1. En Railway, ve al servicio frontend
2. Settings → Domains
3. Click "Custom Domain"
4. Añade: `designer.unitnave.com`
5. Railway te dará un registro CNAME
6. En tu DNS (donde tienes unitnave.com):
   ```
   Tipo: CNAME
   Nombre: designer
   Valor: [el que te dio Railway]
   ```

---

## 💰 Costes Estimados Railway

### Plan Recomendado: PRO ($20/mes)

**Incluye:**
- 32 GB RAM
- 32 vCPU
- $20 en créditos de uso

**Costes adicionales:**
- Renders Blender: ~$0.15-0.25 cada uno
- Con $20 de créditos: ~100-130 renders/mes
- Tráfico normal: incluido

**Ejemplo mes típico:**
- Plan PRO: $20
- 50 renders Blender: ~$10
- **Total: ~$30/mes**

### Optimización de Costes

1. **Caché de renders**: Reutilizar renders idénticos
2. **Límite por usuario**: 2-3 renders gratis, resto de pago
3. **Renders asíncronos**: Procesar en horarios de menos uso

---

## 📚 Uso de la Aplicación

### Para Clientes

1. **Acceder al diseñador**
   ```
   https://designer.unitnave.com
   ```

2. **Diseñar nave**
   - Ajustar dimensiones con sliders
   - Arrastrar elementos desde panel izquierdo
   - Ver cálculos en tiempo real

3. **Visualización**
   - Vista 3D: Explorar libremente
   - Vista planta: Diseño en 2D
   - Vista exterior: Ver fachada completa

4. **Exportar**
   - Render profesional (60-90 seg)
   - PDF con planos
   - Guardar diseño
   - Enviar a Isolan

### Para Administradores

**Ver todos los diseños:**
```bash
GET https://tu-backend.up.railway.app/api/designs
```

**Ver estado de renders:**
```bash
GET https://tu-backend.up.railway.app/api/render/{render_id}
```

---

## 🔧 Desarrollo y Personalización

### Añadir Nuevo Tipo de Elemento

1. **Backend** (`main.py`):
   ```python
   # En calculate_capacity()
   elif element.type == "nuevo_elemento":
       # Lógica de cálculo
   ```

2. **Frontend** (`App.jsx`):
   ```jsx
   // Crear componente 3D
   function NuevoElemento({ position, dimensions }) {
       return <Box args={[...]} />
   }
   
   // Añadir al switch en render
   case 'nuevo_elemento':
       return <NuevoElemento ... />
   ```

### Personalizar Materiales

En `blender_render.py`, modifica las funciones `create_*_material()`:

```python
bsdf.inputs['Base Color'].default_value = (r, g, b, 1)
bsdf.inputs['Roughness'].default_value = 0.5
bsdf.inputs['Metallic'].default_value = 0.8
```

---

## 🐛 Solución de Problemas

### Backend no arranca

```bash
# Ver logs en Railway
railway logs

# Verificar Python
python --version  # Debe ser 3.11+

# Reinstalar dependencias
pip install -r requirements.txt --force-reinstall
```

### Frontend no se conecta al backend

1. Verificar VITE_API_URL en `.env`
2. Verificar CORS en backend (ALLOWED_ORIGINS)
3. Ver consola del navegador (F12)

### Renders Blender fallan

1. Verificar que Blender está instalado:
   ```bash
   blender --version
   ```

2. Ver logs de render:
   ```bash
   tail -f /tmp/renders/log.txt
   ```

3. Aumentar memoria en Railway (necesita >4GB)

### Errores de CORS

En `main.py`, añadir tu dominio:
```python
allow_origins=[
    "https://tudominio.com",
    "https://www.tudominio.com"
]
```

---

## 📖 Documentación API

### Endpoints Principales

#### POST /api/designs
Crear nuevo diseño
```json
{
  "name": "Mi nave",
  "dimensions": {"length": 40, "width": 25, "height": 10},
  "elements": [...]
}
```

#### GET /api/designs/{id}
Obtener diseño específico

#### POST /api/calculate
Calcular capacidad y métricas

#### POST /api/render
Solicitar render profesional Blender

#### GET /api/render/{id}
Obtener estado y URL del render

**Documentación completa:** `https://tu-backend/docs`

---

## 🎨 Personalización UI

### Cambiar Colores Corporativos

En `App.jsx`:
```jsx
const COLORS = {
  primary: '#ff6b35',    // Naranja UNITNAVE
  secondary: '#2c3e50',  // Gris oscuro
  background: '#ecf0f1'  // Gris claro
};
```

### Cambiar Logo

Reemplaza el SVG inline en el componente con:
```jsx
<img src="/logo.png" alt="UNITNAVE" />
```

---

## 📞 Soporte

- **Email**: soporte@unitnave.com
- **Documentación**: https://docs.unitnave.com
- **Issues**: GitHub Issues

---

## 📄 Licencia

Propiedad de Isolan Inversiones Inmobiliarias
© 2025 UNITNAVE - Todos los derechos reservados

---

## ✅ Checklist de Deploy

- [ ] Código subido a GitHub
- [ ] Backend desplegado en Railway
- [ ] PostgreSQL conectado
- [ ] Blender instalado en Railway
- [ ] Frontend desplegado en Railway
- [ ] Variables de entorno configuradas
- [ ] Dominio personalizado configurado (opcional)
- [ ] Primera nave de prueba diseñada
- [ ] Render de prueba completado
- [ ] PDF generado correctamente

---

¡UNITNAVE Designer está listo para transformar cómo tus clientes exploran naves industriales! 🎉🏭
 
