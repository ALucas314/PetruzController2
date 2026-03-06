#!/bin/bash

echo "========================================"
echo "Iniciando servidor backend..."
echo "========================================"

cd server

if [ ! -d "node_modules" ]; then
    echo "Instalando dependências..."
    npm install
fi

echo ""
echo "Iniciando servidor na porta 3001..."
echo ""

npm run dev
