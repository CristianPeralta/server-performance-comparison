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
  ab -n $REQUESTS -c $CONCURRENCY -p $JSON_PAYLOAD -T $CONTENT_TYPE -s 60 -r -k -v 4 -l -q $url > $outfile
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

# Function to extract timestamps and response codes from ab output and write CSV
# Usage: extract_timestamps_responseCode_csv input.txt output.csv
extract_timestamps_responseCode_csv() {
  local infile="$1"
  local outfile="$2"

  echo "timeStamp,responseCode" > "$outfile"
  local responseCode=""
  local dateStr=""
  local timestamp=""
  local expect_header=0
  local expect_date=0
  local last_json=""
  local last_response_code_line_num=0
  local line_num=0

  while IFS= read -r line || [[ -n "$line" ]]; do
    line_num=$((line_num+1))
    # Save last JSON line
    if [[ "$line" =~ ^\{.*\}$ ]]; then
      last_json="$line"
    fi
    # Look for response code
    if [[ "$line" =~ ^LOG:\ Response\ code\ =\ ([0-9]{3}) ]]; then
      responseCode="${BASH_REMATCH[1]}"
      expect_header=1
      last_response_code_line_num=$line_num
      continue
    fi
    # After response code, wait for LOG: header received:
    if [[ $expect_header -eq 1 && "$line" == "LOG: header received:"* ]]; then
      expect_header=0
      expect_date=1
      continue
    fi
    # After header, look for Date:
    if [[ $expect_date -eq 1 && "$line" =~ ^Date: ]]; then
      dateStr=$(echo "$line" | sed -E 's/^Date: //;s/ GMT$//')
      timestamp=$(date -d "$dateStr" +%s 2>/dev/null)
      if [[ -n "$timestamp" && -n "$responseCode" ]]; then
        echo "$timestamp,$responseCode" >> "$outfile"
      fi
      expect_date=0
      responseCode=""
      dateStr=""
      timestamp=""
      continue
    fi
  done < "$infile"

  # Handle the last response code if it wasn't paired (end of file)
  if [[ $expect_header -eq 1 && -n "$responseCode" && -n "$last_json" ]]; then
    # Try to extract created_at or timestamp from last_json
    if [[ "$last_json" =~ "created_at":"([0-9TZ\-\.:]+)" ]]; then
      dateStr="${BASH_REMATCH[1]}"
    elif [[ "$last_json" =~ "timestamp":"([0-9TZ\-\.:]+)" ]]; then
      dateStr="${BASH_REMATCH[1]}"
    else
      dateStr=""
    fi
    # Remove fractional seconds if present
    dateStr=$(echo "$dateStr" | sed -E 's/\.[0-9]+Z$/Z/')
    timestamp=$(date -d "$dateStr" +%s 2>/dev/null)
    if [[ -n "$timestamp" && -n "$responseCode" ]]; then
      echo "$timestamp,$responseCode" >> "$outfile"
    fi
  fi
}

# Function to extract ab metrics
extract_ab_metrics() {
  local infile=$1
  local outfile=$2
  local title=$3

  # Detect if is node or laravel
  # Example extract_jmeter_metrics $SUMMARY_FILE "Laravel + JMeter"
  local server
  if [[ "$title" == *"ode"* ]]; then
    server="node"
  else
    server="laravel"
  fi
  echo "Server: $server"

  echo "=== $title ===" >> $outfile
  echo "" >> $outfile
  
  # Extract key metrics
  grep "Time per request" $infile | head -1 >> $outfile
  grep "Failed requests" $infile >> $outfile
  grep "Complete requests" $infile >> $outfile
  grep "Requests per second" $infile >> $outfile
  echo "" >> $outfile

  # Append metrics as a JSON object (detecting if is node or laravel)
  # Get values from ab output
  local avg_time_raw=$(grep "Time per request" "$infile" | head -n1 | awk '{print $4}')
  local avg_time=$(echo "$avg_time_raw" | tr ',' '.')
  local rps=$(grep "Requests per second" $infile | awk '{print $4}')
  local error_count=$(grep "Failed requests" $infile | awk '{print $3}')
  local total_requests=$(grep "Complete requests" $infile | awk '{print $3}')
  local time_taken=$(grep "Time taken for tests" $infile | awk '{print $5}')

  echo "avg_time = '$avg_time'"

  if test -f "$SUMMARY_JSON_AB"; then
    # If it exists, get the content and update the metrics
    local metrics=$(jq ". + {\"$server\": {\"avgResponse\": $avg_time, \"throughput\": $rps, \"errors\": $error_count, \"complete\": $total_requests, \"rps\": $rps, \"timeTaken\": $time_taken}}" $SUMMARY_JSON_AB)
    # Replace the content with the new metrics
    echo "$metrics" > $SUMMARY_JSON_AB
  else
    # If it doesn't exist, create it with the first { bracket
    echo -e "{\n  \"$server\": {\n    \"avgResponse\": $avg_time,\n    \"throughput\": $rps,\n    \"errors\": $error_count,\n    \"complete\": $total_requests,\n    \"rps\": $rps,\n    \"timeTaken\": $time_taken \n  }\n}" > $SUMMARY_JSON_AB
  fi
}

# Function to extract jmeter metrics
extract_jmeter_metrics() {
  local infile=$1
  local outfile=$2
  local title=$3

  echo "=== $title ===" >> $outfile

  # Detect if is node or laravel
  # Example extract_jmeter_metrics $SUMMARY_FILE "Laravel + JMeter"
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

  # Time taken - default 60 seconds
  local time_taken=60

  # Output metrics
  echo "Time per request: ${avg_time} ms" >> "$outfile"
  echo "Failed requests: ${error_count}" >> "$outfile"
  echo "Complete requests: ${total_requests}" >> "$outfile"
  echo "Requests per second: ${rps}" >> "$outfile"
  echo "" >> "$outfile"

  # Append metrics as a JSON object (detecting if is node or laravel)
  
  if test -f "$SUMMARY_JSON_JMETER"; then
    # If it exists, get the content and update the metrics
    local metrics=$(jq ". + {\"$server\": {\"avgResponse\": $(echo "$avg_time" | awk '{printf "%.0f", $1}'), \"throughput\": $rps, \"errors\": $error_count, \"complete\": $total_requests, \"rps\": $rps, \"timeTaken\": $time_taken}}" $SUMMARY_JSON_JMETER)
    # Replace the content with the new metrics
    echo "$metrics" > $SUMMARY_JSON_JMETER
  else
    # If it doesn't exist, create it with the first { bracket
    echo -e "{\n  \"$server\": {\n    \"avgResponse\": $(echo "$avg_time" | awk '{printf "%.0f", $1}'),\n    \"throughput\": $rps,\n    \"errors\": $error_count,\n    \"complete\": $total_requests,\n    \"rps\": $rps,\n    \"timeTaken\": $time_taken\n  }\n}" > $SUMMARY_JSON_JMETER
  fi
}