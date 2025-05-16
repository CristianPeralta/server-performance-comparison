#!/bin/bash

# Function to analyze resource usage from docker stats
analyze_usage() {
  local infile=$1
  local cpu_sum=0
  local mem_percentage_sum=0
  local count=0

  echo "Processing $infile..."

  while IFS=, read -r cpu mem; do
    if [[ "$cpu" == "cpu" ]]; then continue; fi

    cpu_val=$(echo "$cpu" | tr -d '%')
    mem_percentage=$(echo "$mem" | tr -d '%')

    if [[ -z "$cpu_val" || -z "$mem_percentage" ]]; then
      continue
    fi

    cpu_sum=$(echo "$cpu_sum + $cpu_val" | bc)
    mem_percentage_sum=$(echo "$mem_percentage_sum + $mem_percentage" | bc)
    count=$((count + 1))
  done < "$infile"

  if [[ $count -gt 0 ]]; then
    avg_cpu=$(echo "scale=2; $cpu_sum / $count" | bc)
    avg_mem_pct=$(echo "scale=2; $mem_percentage_sum / $count" | bc)
    echo "CPU avg: $avg_cpu% | Memory avg: $avg_mem_pct%"
  else
    echo "No valid data to analyze."
  fi
}

# Test function
test_analyze_usage() {
  # Create test file
  echo "cpu,memory" > test_usage.csv
  echo "75.62%,0.50%" >> test_usage.csv
  echo "0.00%,0.17%" >> test_usage.csv
  echo "0.00%,0.00%" >> test_usage.csv
  echo "0.00%,0.00%" >> test_usage.csv
  
  # Run analysis
  echo "Testing analyze_usage with test data..."
  analyze_usage test_usage.csv
  
  # Clean up
  rm test_usage.csv
}

# If running this script directly, run tests
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  test_analyze_usage
fi


# Function to monitor container resource usage
monitor_container() {
  # (original function, no changes)
  local container_name=$1
  local outfile=$2
  echo "cpu,memory" > $outfile

  local start_time=$(date +%s)
  echo "Monitoring container $container_name for $DURATION seconds..."
  local end_time=$((start_time + DURATION + 5))
  local now=$start_time

  while [ $now -lt $end_time ]; do
    docker stats --no-stream --format "{{.CPUPerc}},{{.MemPerc}}" $container_name >> $outfile
    sleep 1
    now=$(date +%s)
  done
}

# Function to monitor container resource usage while a PID is alive
# Usage:
#   run_benchmark ... &
#   BENCH_PID=$!
#   monitor_container_until_pid_exit mycontainer usage.csv $BENCH_PID
#   wait $BENCH_PID
monitor_container_until_pid_exit() {
  local container_name=$1
  local outfile=$2
  local pid_to_watch=$3
  echo "cpu,memory" > $outfile

  # Wait for the process to really exist (max 1 second)
  for i in {1..10}; do
    if kill -0 $pid_to_watch 2>/dev/null; then
      break
    fi
    sleep 0.1
  done

  # Capture while the process is alive
  while kill -0 $pid_to_watch 2>/dev/null; do
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

# Function to run jmeter with POST
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

# Function to extract jmeter metrics
extract_jmeter_metrics() {
  local infile=$1
  local outfile=$2
  local title=$3

  echo "=== $title ===" >> $outfile

  # Detect if is node or laravel
  # Example extract_jmeter_metrics results/laravel_jmeter-resumen.log $SUMMARY_FILE "Laravel + JMeter"
  local server
  if [[ "$title" == *"ode"* ]]; then
    server="node"
  else
    server="laravel"
  fi
  echo "Server: $server"
  
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

  # Append metrics as a JSON object (detecting if is node or laravel)
  # The expected result scheme is this
  # {
  #   "laravel": {
  #     "avgResponse": 83,
  #     "throughput": 10.7,
  #     "errors": 0,
  #     "complete": 643,
  #     "rps": 10.7
  #   },
  #   "node": {
  #     "avgResponse": 3,
  #     "throughput": 10.7,
  #     "errors": 0,
  #     "complete": 643,
  #     "rps": 10.7
  #   }
  # }
  
  # TODO: Improve this for more servers
  # Verify if summary.json exists
  if test -f "$SUMMARY_JSON"; then  
    # If it exists, append the metrics to the file, create it with the end } bracket
    echo -e ",\n  \"$server\": {
    \"avgResponse\": $avg_time,
    \"throughput\": $rps,
    \"errors\": $error_count,
    \"complete\": $total_requests,
    \"rps\": $rps
  }}" >> $SUMMARY_JSON
  else
    # If it doesn't exist, create it with the first { bracket
    echo -e "{\n  \"$server\": {
    \"avgResponse\": $avg_time,
    \"throughput\": $rps,
    \"errors\": $error_count,
    \"complete\": $total_requests,
    \"rps\": $rps
  }" > $SUMMARY_JSON
  fi
}