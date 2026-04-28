#!/bin/bash
echo "🧹 Iniciando limpieza de emergencia..."
rm -rf .next/
find . -maxdepth 2 -name "*.log" -delete
echo "✅ Proyecto Dashlify-App listo para el agente."
