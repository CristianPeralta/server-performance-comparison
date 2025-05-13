#!/bin/bash

# Configuration
REQUESTS=643
CONCURRENCY=1
DURATION=60
JSON_PAYLOAD="test_data_message.json"
CONTENT_TYPE="application/json"

LARAVEL_URL="http://localhost:8000/api/messages"
NODE_URL="http://localhost:3000/api/messages"

# Create output directories
mkdir -p results

# Import utility functions
source utils.sh

# === Argument parsing ===
MODE="${1:-jmeter}"
MODE=$(echo "$MODE" | tr '[:upper:]' '[:lower:]')
echo "[INFO] Benchmark mode: $MODE"

# Run Laravel benchmark
echo "Starting Laravel benchmark..."
monitor_container laravel-app results/laravel_usage.csv &
PID_LARAVEL=$!
if [[ "$MODE" == "ab" ]]; then
  run_benchmark $LARAVEL_URL results/laravel_ab.txt
else
  run_jmeter $LARAVEL_URL results/laravel_jmeter.csv
fi
wait $PID_LARAVEL

# Run Node.js benchmark
echo "Starting Node.js benchmark..."
monitor_container nodejs-app results/node_usage.csv &
PID_NODE=$!
if [[ "$MODE" == "ab" ]]; then
  run_benchmark $NODE_URL results/node_ab.txt
else
  run_jmeter $NODE_URL results/node_jmeter.csv
fi
wait $PID_NODE

# Generate summary
echo "Generating summary..."
SUMMARY_FILE="results/summary.txt"
: > $SUMMARY_FILE
if [[ "$MODE" == "ab" ]]; then
  extract_ab_metrics results/laravel_ab.txt $SUMMARY_FILE "Laravel + Apache Benchmark"
else
  extract_jmeter_metrics results/laravel_jmeter-resumen.log $SUMMARY_FILE "Laravel + JMeter"
fi
echo "Laravel Resource Usage:" >> $SUMMARY_FILE
analyze_usage results/laravel_usage.csv >> $SUMMARY_FILE
echo "" >> $SUMMARY_FILE
if [[ "$MODE" == "ab" ]]; then
  extract_ab_metrics results/node_ab.txt $SUMMARY_FILE "Node.js Benchmark"
else
  extract_jmeter_metrics results/node_jmeter-resumen.log $SUMMARY_FILE "Node.js + JMeter"
fi
echo "Node.js Resource Usage:" >> $SUMMARY_FILE
analyze_usage results/node_usage.csv >> $SUMMARY_FILE
echo "" >> $SUMMARY_FILE

cat $SUMMARY_FILE
echo "Summary saved to $SUMMARY_FILE"
