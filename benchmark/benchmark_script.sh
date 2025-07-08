#!/bin/bash

LARAVEL_URL="http://localhost:8000/api/messages"
NODE_URL="http://localhost:3000/api/messages"

# Create output directories
mkdir -p results
mkdir -p results/ab
mkdir -p results/jmeter

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
  run_benchmark $LARAVEL_URL results/ab/laravel_ab.txt &
  BENCH_PID=$!
else
  run_jmeter $LARAVEL_URL results/jmeter/laravel_jmeter.csv &
  BENCH_PID=$!
fi
if [[ "$MODE" == "ab" ]]; then
monitor_container_until_pid_exit laravel-app results/ab/laravel_usage.csv $BENCH_PID
wait $BENCH_PID
else
monitor_container_until_pid_exit laravel-app results/jmeter/laravel_usage.csv $BENCH_PID
wait $BENCH_PID
fi

# Run Node.js benchmark
echo "Starting Node.js benchmark..."
if [[ "$MODE" == "ab" ]]; then
  run_benchmark $NODE_URL results/ab/node_ab.txt &
  BENCH_PID=$!
else
  run_jmeter $NODE_URL results/jmeter/node_jmeter.csv &
  BENCH_PID=$!
fi
if [[ "$MODE" == "ab" ]]; then
monitor_container_until_pid_exit nodejs-app results/ab/node_usage.csv $BENCH_PID
wait $BENCH_PID
else
monitor_container_until_pid_exit nodejs-app results/jmeter/node_usage.csv $BENCH_PID
wait $BENCH_PID
fi

# Generate summary
echo "Generating summary..."
SUMMARY_FILE_AB="results/ab/summary.txt"
SUMMARY_FILE_JMETER="results/jmeter/summary.txt"
SUMMARY_JSON_JMETER="../simulation-visual/data/jmeter/summary.json"
SUMMARY_JSON_AB="../simulation-visual/data/ab/summary.json"
if [[ "$MODE" == "ab" ]]; then
  : > $SUMMARY_FILE_AB
else
  : > $SUMMARY_FILE_JMETER
fi
if [[ "$MODE" == "ab" ]]; then
  extract_ab_metrics results/ab/laravel_ab.txt $SUMMARY_FILE_AB "Laravel + Apache Benchmark"
  extract_timestamps_responseCode_csv results/ab/laravel_ab.txt results/ab/laravel_ab_simple.csv
else
  extract_jmeter_metrics results/jmeter/laravel_jmeter-resumen.log $SUMMARY_FILE_JMETER "Laravel + JMeter"
fi
if [[ "$MODE" == "ab" ]]; then
  echo "Laravel Resource Usage:" >> $SUMMARY_FILE_AB
  analyze_usage results/ab/laravel_usage.csv >> $SUMMARY_FILE_AB
  echo "" >> $SUMMARY_FILE_AB
else
  echo "Laravel Resource Usage:" >> $SUMMARY_FILE_JMETER
  analyze_usage results/jmeter/laravel_usage.csv >> $SUMMARY_FILE_JMETER
  echo "" >> $SUMMARY_FILE_JMETER
fi
if [[ "$MODE" == "ab" ]]; then
  extract_ab_metrics results/ab/node_ab.txt $SUMMARY_FILE_AB "Node.js Benchmark"
  extract_timestamps_responseCode_csv results/ab/node_ab.txt results/ab/node_ab_simple.csv
else
  extract_jmeter_metrics results/jmeter/node_jmeter-resumen.log $SUMMARY_FILE_JMETER "Node.js + JMeter"
fi
if [[ "$MODE" == "ab" ]]; then
  echo "Node.js Resource Usage:" >> $SUMMARY_FILE_AB
  analyze_usage results/ab/node_usage.csv >> $SUMMARY_FILE_AB
  echo "" >> $SUMMARY_FILE_AB
else
  echo "Node.js Resource Usage:" >> $SUMMARY_FILE_JMETER
  analyze_usage results/jmeter/node_usage.csv >> $SUMMARY_FILE_JMETER
  echo "" >> $SUMMARY_FILE_JMETER
fi
if [[ "$MODE" == "ab" ]]; then
  cat $SUMMARY_FILE_AB
  echo "Summary saved to $SUMMARY_FILE_AB"
else
  cat $SUMMARY_FILE_JMETER
  echo "Summary saved to $SUMMARY_FILE_JMETER"
fi

## Copy results to simulation-visual/data/ab and simulation-visual/data/
if [[ "$MODE" == "ab" ]]; then 
  cp results/ab/laravel_ab_simple.csv ../simulation-visual/data/ab/laravel_ab_simple.csv
  cp results/ab/node_ab_simple.csv ../simulation-visual/data/ab/node_ab_simple.csv
  cp results/ab/summary.txt ../simulation-visual/data/ab/summary.txt
  cp results/ab/laravel_usage.csv ../simulation-visual/data/ab/laravel_usage.csv
  cp results/ab/node_usage.csv ../simulation-visual/data/ab/node_usage.csv
else
  cp results/jmeter/laravel_jmeter.csv ../simulation-visual/data/jmeter/laravel_jmeter.csv
  cp results/jmeter/node_jmeter.csv ../simulation-visual/data/jmeter/node_jmeter.csv
  cp results/jmeter/laravel_usage.csv ../simulation-visual/data/jmeter/laravel_usage.csv
  cp results/jmeter/node_usage.csv ../simulation-visual/data/jmeter/node_usage.csv
fi
