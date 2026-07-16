#!/bin/bash

# Setup script for Interactive Branching Adventure project

# Stop on errors
set -e

echo "=== 1. Configurando Backend Django ==="
cd backend

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creando entorno virtual Python (venv)..."
    python3 -m venv venv
fi

# Activate virtualenv
source venv/bin/activate

echo "Instalando dependencias de Python..."
pip install -r requirements.txt

echo "Ejecutando migraciones de base de datos SQLite..."
python manage.py makemigrations core
python manage.py migrate

echo "Sembrando datos de prueba en la base de datos..."
python manage.py seed_story

cd ..

echo "=== 2. Configurando Frontend React + Vite ==="
cd frontend

echo "Instalando dependencias de Node.js (Vite, React, Router)..."
npm install

echo "=== 3. Preparación Completada ==="
echo ""
echo "Para arrancar la aplicación, ejecuta estos dos comandos en terminales separadas:"
echo ""
echo "Backend Django:"
echo "  cd backend && source venv/bin/activate && python manage.py runserver"
echo ""
echo "Frontend React:"
echo "  cd frontend && npm run dev"
echo ""
