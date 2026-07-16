# Juego de Decisiones (Interactive Branching Adventure)

Este proyecto es una plataforma interactiva multijugador para jugar aventuras y dinámicas basadas en la toma de decisiones, donde un anfitrión (host) guía a los jugadores a través de una historia ramificada y los jugadores votan en tiempo real para decidir el rumbo de la aventura.

La arquitectura del proyecto está estructurada como un **Monorepo** que agrupa tanto el servidor backend como la interfaz frontend en un solo lugar para simplificar su gestión y desarrollo.

---

## 🚀 Arquitectura del Proyecto

El repositorio está dividido en dos partes principales:

1. **`backend/` (Django + Django Channels):**
   - API RESTful para gestionar usuarios, historias, escenas y elecciones.
   - Servidor WebSocket (Daphne/Channels) para manejar votaciones en tiempo real y sincronizar la vista del host con las decisiones de los jugadores.
   - Integración con **Gemini AI** (Gemini 1.5 Flash) para la generación automática y optimización de contenido e imágenes de las escenas.
   - Base de datos SQLite para desarrollo local rápida.

2. **`frontend/` (React + Vite):**
   - Panel de control interactivo para creadores/profesores (Editor de historias).
   - Interfaz en tiempo real para los jugadores y para el Host de la partida.
   - Estilizado premium y animaciones responsivas.

---

## 🛠️ Requisitos Previos

Asegúrate de tener instalados los siguientes componentes en tu sistema:
- **Python 3.10+**
- **Node.js 18+** y npm
- **Git**

---

## ⚙️ Configuración e Instalación Rápida

El proyecto incluye un script de automatización (`setup.sh`) en la raíz que se encarga de configurar tanto el backend como el frontend de forma automática.

Para preparar el entorno de desarrollo, ejecuta en tu terminal:

```bash
chmod +x setup.sh
./setup.sh
```

El script realizará las siguientes acciones de forma automática:
1. Crear el entorno virtual de Python (`venv`) en la carpeta del backend.
2. Instalar todas las dependencias del backend (`requirements.txt`).
3. Ejecutar las migraciones de base de datos e inicializar datos semilla.
4. Instalar las dependencias de Node.js en el frontend.

---

## 🔑 Variables de Entorno (.env)

El backend requiere de una API Key de Gemini para el funcionamiento de las características de Inteligencia Artificial (generación y optimización de escenas).

1. Ve a la carpeta `backend/`.
2. Crea un archivo llamado `.env` copiando la plantilla de ejemplo:
   ```bash
   cp .env.example .env
   ```
3. Edita el archivo `.env` e introduce tu clave de API:
   ```env
   GEMINI_API_KEY=tu_api_key_aqui
   ```

---

## 🏃 Ejecución en Desarrollo

Una vez completada la instalación, puedes levantar los servidores de desarrollo ejecutando estos comandos en terminales separadas:

### 1. Iniciar el Backend (Django)
```bash
cd backend
source venv/bin/activate
python manage.py runserver
```
*El servidor backend estará disponible en `http://localhost:8000`.*

### 2. Iniciar el Frontend (React)
```bash
cd frontend
npm run dev
```
*El frontend estará disponible en `http://localhost:5173` (o el puerto indicado por Vite).*

---

## 📝 Contribuciones y Versionado

Este repositorio utiliza una rama principal:
- `main`: Contiene el código de producción estable y funcional.

Por favor, asegúrate de mantener actualizado tu archivo `.env` localmente y **nunca** subir claves de API reales al repositorio (el archivo `.env` ya se encuentra protegido en el `.gitignore` global).
