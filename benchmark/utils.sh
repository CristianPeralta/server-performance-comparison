#!/bin/bash

# Función para analizar uso de recursos desde docker stats
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
