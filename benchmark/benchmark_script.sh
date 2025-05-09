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

# Function to extract ab metrics
extract_ab_metrics() {
  local infile=$1
  local outfile=$2
  local title=$3

  echo "=== $title ===" >> $outfile
  echo "" >> $outfile
  
  # Extract key metrics
  grep "Time per request" $infile | head -1 >> $outfile
  grep "Transfer rate" $infile >> $outfile
  grep "Failed requests" $infile >> $outfile
  grep "Complete requests" $infile >> $outfile
  grep "Requests per second" $infile >> $outfile
  echo "" >> $outfile
}

# Import utility functions
source utils.sh

# Run Laravel benchmark
echo "Starting Laravel benchmark..."
monitor_container laravel-app results/laravel_usage.csv &
PID_LARAVEL=$!
run_benchmark $LARAVEL_URL results/laravel_ab.txt
wait $PID_LARAVEL

# Run Node.js benchmark
echo "Starting Node.js benchmark..."
monitor_container nodejs-app results/node_usage.csv &
PID_NODE=$!
run_benchmark $NODE_URL results/node_ab.txt
wait $PID_NODE

# Generate summary
echo "Generating summary..."
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
echo "Summary saved to $SUMMARY_FILE"
