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

# Function to monitor container resource usage
monitor_container() {
  local container_name=$1
  local outfile=$2
  echo "cpu,memory" > $outfile

  for i in $(seq 1 $DURATION); do
    # Get stats for each container and append to file
    docker stats --no-stream --format "{{.CPUPerc}},{{.MemPerc}}" $container_name >> $outfile
    sleep 1
  done

  # TODO: Fix this because its taking more time than 60 seconds
}

# Function to run ab with POST
run_benchmark() {
  local url=$1
  local outfile=$2
  echo "Testing $url..."
  # Make a HTTP POST request to the specified URL, with the content of $JSON_PAYLOAD as the request body, and with the following parameters:
  #   -n $REQUESTS: make $REQUESTS requests
  #   -c $CONCURRENCY: make $CONCURRENCY concurrent requests
  #   -p $JSON_PAYLOAD: read the request body from the file $JSON_PAYLOAD
  #   -T $CONTENT_TYPE: specify the request content type (in this case, application/json)
  #   -s 60: timeout in seconds (increased)
  #   -r: don't exit on socket receive errors
  #   -k: Use HTTP KeepAlive feature
  #   -d: don't show percentiles served table
  #   -S: don't show confidence estimators and warnings
  #   -v 4: verbose output for debugging
  #   -l: accept variable document length (for dynamic pages)
  #   -q: don't show progress when doing more than 150 requests
  # The output is redirected to $outfile
  ab -n $REQUESTS -c $CONCURRENCY -p $JSON_PAYLOAD -T $CONTENT_TYPE -s 60 -r -k -d -S -v 4 -l -q $url > $outfile
}

run_jmeter() {
  local url=$1
  local outfile=$2
  echo "Testing $url..."
  local port=$(echo "$url" | sed -nE 's#^[a-z]+://[^:/]+:([0-9]+).*#\1#p')
  echo "Port: $port"
  jmeter -n -t test-plan.jmx -l $outfile -Jport=$port > "${outfile%.csv}-resumen.log"
}

# Function to extract ab metrics
extract_ab_metrics() {
  local infile=$1
  local outfile=$2
  local title=$3

  echo "=== $title ===" >> $outfile
  echo "" >> $outfile
  
  # Extract key metrics
  grep "Time per request" $infile | head -1 >> $outfile
  grep "Failed requests" $infile >> $outfile
  grep "Complete requests" $infile >> $outfile
  grep "Requests per second" $infile >> $outfile
  echo "" >> $outfile
}

extract_jmeter_metrics() {
  local infile=$1
  local outfile=$2
  local title=$3

  echo "=== $title ===" >> $outfile
  echo "" >> $outfile

  # Get the final summary line
  local final_summary=$(grep "summary =" "$infile" | tail -1)
  
  if [[ -z "$final_summary" ]]; then
    echo "No JMeter summary found in $infile" >> "$outfile"
    echo "" >> "$outfile"
    return
  fi

  # Extract values directly using awk for greater precision
  # Format: summary = 643 in 00:01:00 = 10.7/s Avg: 65 Min: 50 Max: 107 Err: 0 (0.00%)
  
  # Total requests - third field
  local total_requests=$(echo "$final_summary" | awk '{print $3}')
  
  # Avg time - field after "Avg:"
  local avg_time=$(echo "$final_summary" | awk '{for(i=1;i<=NF;i++) if($i=="Avg:") print $(i+1)}')
  
  # Requests per second - field before "/s"
  local rps=$(echo "$final_summary" | awk '{for(i=1;i<=NF;i++) if(index($i,"/s")>0) {gsub("/s","", $i); print $i}}')
  
  # Error count - field after "Err:"
  local error_count=$(echo "$final_summary" | awk '{for(i=1;i<=NF;i++) if($i=="Err:") print $(i+1)}')

  # Output metrics
  echo "Time per request: ${avg_time} ms" >> "$outfile"
  echo "Failed requests: ${error_count}" >> "$outfile"
  echo "Complete requests: ${total_requests}" >> "$outfile"
  echo "Requests per second: ${rps}" >> "$outfile"
  echo "" >> "$outfile"
}

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
