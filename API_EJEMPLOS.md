# 📡 EJEMPLOS DE USO DE LA API

## Endpoints Disponibles

Base URL: `https://tu-backend.railway.app`

---

## 1. Crear un Diseño Nuevo

**POST** `/api/designs`

```json
{
  "name": "Nave Corredor A-2 Madrid",
  "dimensions": {
    "length": 40,
    "width": 25,
    "height": 10
  },
  "elements": [
    {
      "id": "shelf-1",
      "type": "shelf",
      "position": {
        "x": 5,
        "y": 0,
        "z": 5,
        "rotation": 0
      },
      "dimensions": {
        "length": 10,
        "height": 8,
        "depth": 1.1
      },
      "properties": {
        "levels": 4,
        "shelf_type": "conventional"
      }
    },
    {
      "id": "office-1",
      "type": "office",
      "position": {
        "x": 2,
        "y": 0,
        "z": 2,
        "rotation": 0
      },
      "dimensions": {
        "length": 10,
        "width": 8,
        "height": 3.5
      },
      "properties": {
        "floors": 1
      }
    },
    {
      "id": "dock-1",
      "type": "dock",
      "position": {
        "x": 20,
        "y": 0,
        "z": 0,
        "rotation": 0
      },
      "dimensions": {
        "width": 3.0
      },
      "properties": {}
    }
  ]
}
```

**Respuesta:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Nave Corredor A-2 Madrid",
  "dimensions": { ... },
  "elements": [ ... ],
  "created_at": "2025-01-15T10:30:00",
  "updated_at": "2025-01-15T10:30:00"
}
```

---

## 2. Calcular Capacidad

**POST** `/api/calculate`

```json
{
  "name": "Cálculo de capacidad",
  "dimensions": {
    "length": 40,
    "width": 25,
    "height": 10
  },
  "elements": [
    {
      "id": "shelf-1",
      "type": "shelf",
      "position": { "x": 5, "y": 0, "z": 5, "rotation": 0 },
      "dimensions": { "length": 10, "height": 8, "depth": 1.1 },
      "properties": { "levels": 4 }
    }
  ]
}
```

**Respuesta:**
```json
{
  "total_pallets": 240,
  "usable_area": 980.5,
  "occupied_area": 420.3,
  "circulation_area": 560.2,
  "efficiency_percentage": 42.85,
  "warnings": [
    "Área de circulación insuficiente (recomendado >30%)",
    "Muelle dock-1 necesita más espacio de maniobra"
  ]
}
```

---

## 3. Solicitar Render Profesional

**POST** `/api/render`

```json
{
  "name": "Render cliente ABC",
  "dimensions": { "length": 50, "width": 30, "height": 12 },
  "elements": [ ... ]
}
```

**Respuesta:**
```json
{
  "render_id": "render-abc-123",
  "status": "processing",
  "estimated_time": "60-90 segundos",
  "message": "Render en proceso. Consulta el estado en /api/render/render-abc-123"
}
```

---

## 4. Obtener Estado del Render

**GET** `/api/render/{render_id}`

**Respuesta (procesando):**
```json
{
  "render_id": "render-abc-123",
  "status": "processing",
  "progress": 45,
  "estimated_remaining": "30 segundos"
}
```

**Respuesta (completado):**
```json
{
  "render_id": "render-abc-123",
  "status": "completed",
  "url": "https://storage.unitnave.com/renders/render-abc-123.png",
  "thumbnail": "https://storage.unitnave.com/renders/render-abc-123_thumb.png",
  "resolution": "1920x1080",
  "file_size": "2.4 MB"
}
```

---

## 5. Obtener un Diseño

**GET** `/api/designs/{design_id}`

```bash
curl https://tu-backend.railway.app/api/designs/550e8400-e29b-41d4-a716-446655440000
```

**Respuesta:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Nave Corredor A-2 Madrid",
  "dimensions": { ... },
  "elements": [ ... ],
  "created_at": "2025-01-15T10:30:00",
  "updated_at": "2025-01-15T10:30:00"
}
```

---

## 6. Listar Todos los Diseños

**GET** `/api/designs?limit=50`

```bash
curl https://tu-backend.railway.app/api/designs?limit=20
```

**Respuesta:**
```json
[
  {
    "id": "design-1",
    "name": "Nave Cliente A",
    "created_at": "2025-01-15T10:00:00"
  },
  {
    "id": "design-2",
    "name": "Nave Cliente B",
    "created_at": "2025-01-15T11:00:00"
  }
]
```

---

## 7. Actualizar un Diseño

**PUT** `/api/designs/{design_id}`

```json
{
  "name": "Nave A-2 Madrid (ACTUALIZADA)",
  "dimensions": {
    "length": 45,
    "width": 25,
    "height": 10
  },
  "elements": [ ... ]
}
```

---

## 8. Eliminar un Diseño

**DELETE** `/api/designs/{design_id}`

```bash
curl -X DELETE https://tu-backend.railway.app/api/designs/550e8400...
```

**Respuesta:**
```json
{
  "message": "Diseño eliminado correctamente"
}
```

---

## 9. Exportar a PDF

**POST** `/api/export/pdf`

```json
{
  "name": "Propuesta Cliente ABC",
  "dimensions": { ... },
  "elements": [ ... ]
}
```

**Respuesta:**
```json
{
  "pdf_id": "pdf-abc-123",
  "url": "https://storage.unitnave.com/pdfs/pdf-abc-123.pdf",
  "filename": "Propuesta_Cliente_ABC.pdf"
}
```

---

## 10. Health Check

**GET** `/health`

```bash
curl https://tu-backend.railway.app/health
```

**Respuesta:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-15T12:00:00"
}
```

---

## Ejemplos con cURL

### Crear diseño
```bash
curl -X POST https://tu-backend.railway.app/api/designs \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mi nave",
    "dimensions": {"length": 40, "width": 25, "height": 10},
    "elements": []
  }'
```

### Calcular capacidad
```bash
curl -X POST https://tu-backend.railway.app/api/calculate \
  -H "Content-Type: application/json" \
  -d @mi-diseno.json
```

### Solicitar render
```bash
curl -X POST https://tu-backend.railway.app/api/render \
  -H "Content-Type: application/json" \
  -d @mi-diseno.json
```

---

## Ejemplos con Python

```python
import requests

API_URL = "https://tu-backend.railway.app"

# Crear diseño
design = {
    "name": "Nave Test",
    "dimensions": {"length": 40, "width": 25, "height": 10},
    "elements": []
}

response = requests.post(f"{API_URL}/api/designs", json=design)
design_id = response.json()["id"]

# Calcular capacidad
calc_response = requests.post(f"{API_URL}/api/calculate", json=design)
print(f"Capacidad: {calc_response.json()['total_pallets']} palets")

# Solicitar render
render_response = requests.post(f"{API_URL}/api/render", json=design)
render_id = render_response.json()["render_id"]

# Esperar y obtener render
import time
time.sleep(90)
result = requests.get(f"{API_URL}/api/render/{render_id}")
print(f"Render: {result.json()['url']}")
```

---

## Ejemplos con JavaScript

```javascript
const API_URL = 'https://tu-backend.railway.app';

// Crear diseño
const design = {
  name: 'Nave Test',
  dimensions: { length: 40, width: 25, height: 10 },
  elements: []
};

const response = await fetch(`${API_URL}/api/designs`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(design)
});

const data = await response.json();
console.log('Diseño creado:', data.id);

// Calcular capacidad
const calcResponse = await fetch(`${API_URL}/api/calculate`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(design)
});

const calc = await calcResponse.json();
console.log(`Capacidad: ${calc.total_pallets} palets`);
```

---

## Documentación Interactiva

Railway genera automáticamente documentación interactiva:

**Swagger UI:** `https://tu-backend.railway.app/docs`
**ReDoc:** `https://tu-backend.railway.app/redoc`

En estos endpoints puedes:
- ✅ Ver todos los endpoints disponibles
- ✅ Probar las peticiones directamente
- ✅ Ver esquemas de datos
- ✅ Descargar especificación OpenAPI

---

¡La API está completa y lista para usar! 🚀
