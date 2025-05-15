#!/bin/bash

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

# Configuration
REQUESTS=643
CONCURRENCY=1
DURATION=60
JSON_PAYLOAD="data/test_data_message.json"
CONTENT_TYPE="application/json"

# Run Laravel benchmark
echo "Starting Laravel benchmark..."
if [[ "$MODE" == "ab" ]]; then
  run_benchmark $LARAVEL_URL results/laravel_ab.txt &
  BENCH_PID=$!
else
  run_jmeter $LARAVEL_URL results/laravel_jmeter.csv &
  BENCH_PID=$!
fi
monitor_container_until_pid_exit laravel-app results/laravel_usage.csv $BENCH_PID
wait $BENCH_PID

# Run Node.js benchmark
echo "Starting Node.js benchmark..."
if [[ "$MODE" == "ab" ]]; then
  run_benchmark $NODE_URL results/node_ab.txt &
  BENCH_PID=$!
else
  run_jmeter $NODE_URL results/node_jmeter.csv &
  BENCH_PID=$!
fi
monitor_container_until_pid_exit nodejs-app results/node_usage.csv $BENCH_PID
wait $BENCH_PID

# Generate summary
echo "Generating summary..."
SUMMARY_FILE="results/summary.txt"
SUMMARY_JSON="../simulation-visual/summary.json"
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
