# UNITNAVE Backend - Dockerfile con Blender
FROM python:3.11-slim

# Instalar dependencias del sistema y Blender
RUN apt-get update && apt-get install -y \
    blender \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    && rm -rf /var/lib/apt/lists/*

# Verificar instalación de Blender
RUN blender --version

# Crear directorio de trabajo
WORKDIR /app

# Copiar requirements e instalar dependencias Python
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código de la aplicación
COPY backend/ .

# Crear directorios necesarios
RUN mkdir -p /tmp/renders

# Exponer puerto
EXPOSE 8000

# Comando de inicio
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
