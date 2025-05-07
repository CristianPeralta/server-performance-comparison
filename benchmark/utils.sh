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
    mem_used=$(echo "$mem" | awk -F'/' '{print $1}' | sed 's/[[:space:]]//g')
    mem_total=$(echo "$mem" | awk -F'/' '{print $2}' | sed 's/[[:space:]]//g')

    if [[ -z "$cpu_val" || -z "$mem_used" || -z "$mem_total" ]]; then
      continue
    fi

    mem_used_num=$(echo "$mem_used" | sed 's/[^0-9.]//g')
    mem_total_num=$(echo "$mem_total" | sed 's/[^0-9.]//g')
    mem_total_unit=$(echo "$mem_total" | grep -o '[KMG]iB')

    case "$mem_total_unit" in
      GiB) mem_total_num=$(echo "$mem_total_num * 1024" | bc -l);;
      KiB) mem_total_num=$(echo "$mem_total_num / 1024" | bc -l);;
      MiB) ;; # No conversión necesaria
      *) continue ;;
    esac

    mem_percentage=$(echo "scale=4; ($mem_used_num / $mem_total_num) * 100" | bc)

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
  echo "75.62%,187.6MiB / 31.11GiB" >> test_usage.csv
  echo "0.00%,187.5MiB / 31.11GiB" >> test_usage.csv
  echo "0.00%,187.5MiB / 31.11GiB" >> test_usage.csv
  echo "0.00%,187.5MiB / 31.11GiB" >> test_usage.csv
  
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
