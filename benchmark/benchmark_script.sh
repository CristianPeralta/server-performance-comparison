#!/bin/bash

# Configuración
REQUESTS=643
CONCURRENCY=10
DURATION=60
JSON_PAYLOAD="test_data.json"
CONTENT_TYPE="application/json"

LARAVEL_URL="http://localhost:8000/api/messages"
NODE_URL="http://localhost:3000/api/messages"

# Crear carpetas de salida
mkdir -p results

# Función para monitorear uso de recursos por contenedor
monitor_container() {
  local container_name=$1
  local outfile=$2
  echo "cpu,memory" > $outfile

  for i in $(seq 1 $DURATION); do
    # Get stats for each container and append to file
    docker stats --no-stream --format "{{.CPUPerc}},{{.MemUsage}}" $container_name >> $outfile
    sleep 1
  done
}

# Función para correr ab con POST
run_benchmark() {
  local url=$1
  local outfile=$2
  echo "Testing $url..."
  ab -n $REQUESTS -c $CONCURRENCY -p $JSON_PAYLOAD -T $CONTENT_TYPE $url > $outfile
}

# Función para analizar resultados de ab
extract_ab_metrics() {
  local infile=$1
  local outfile=$2
  local title=$3

  echo "=== $title ===" >> $outfile
  grep "Time per request" $infile | head -1 >> $outfile
  grep "Transfer rate" $infile >> $outfile
  grep "Failed requests" $infile >> $outfile
  echo "" >> $outfile
}

# Importar funciones utilitarias
source utils.sh

# Ejecutar pruebas Laravel
echo "Iniciando prueba para Laravel..."
monitor_container laravel-app results/laravel_usage.csv &
PID_LARAVEL=$!
run_benchmark $LARAVEL_URL results/laravel_ab.txt
wait $PID_LARAVEL

# Ejecutar pruebas Node.js
echo "Iniciando prueba para Node.js..."
monitor_container nodejs-app results/node_usage.csv &
PID_NODE=$!
run_benchmark $NODE_URL results/node_ab.txt
wait $PID_NODE

# Generar resumen
echo "Generando resumen..."
SUMMARY_FILE="results/summary.txt"
: > $SUMMARY_FILE

extract_ab_metrics results/laravel_ab.txt $SUMMARY_FILE "Laravel + Apache Benchmark"
echo "Laravel Resource Usage:" >> $SUMMARY_FILE
analyze_usage results/laravel_usage.csv >> $SUMMARY_FILE
echo "" >> $SUMMARY_FILE

extract_ab_metrics results/node_ab.txt $SUMMARY_FILE "Node.js Benchmark"
echo "Node.js Resource Usage:" >> $SUMMARY_FILE
analyze_usage results/node_usage.csv >> $SUMMARY_FILE
echo "" >> $SUMMARY_FILE

cat $SUMMARY_FILE
echo "Resumen guardado en $SUMMARY_FILE"
