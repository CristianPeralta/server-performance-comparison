#!/bin/bash

# Create results directory if it doesn't exist
mkdir -p results

# Function to run Apache Benchmark with different concurrency levels
run_ab_test() {
    local server=$1
    local url=$2
    local concurrency=$3
    local requests=$4
    local method=$5
    local post_data=$6
    local output_file="results/${server}_${method}_ab_c${concurrency}.txt"
    
    echo "Running Apache Benchmark for ${server} (${method}) with concurrency ${concurrency}..."
    if [ "$method" = "POST" ]; then
        ab -n ${requests} -c ${concurrency} -p ${post_data} -T 'application/json' -g "results/${server}_${method}_ab_c${concurrency}.dat" ${url} > ${output_file}
    else
        ab -n ${requests} -c ${concurrency} -g "results/${server}_${method}_ab_c${concurrency}.dat" ${url} > ${output_file}
    fi
}

# Function to measure response time
measure_response_time() {
    local server=$1
    local url=$2
    local method=$3
    local post_data=$4
    local output_file="results/${server}_${method}_response_time.txt"
    
    echo "Measuring response time for ${server} (${method})..."
    for i in {1..100}; do
        if [ "$method" = "POST" ]; then
            curl -X POST -H "Content-Type: application/json" -d @${post_data} -w "%{time_total}\n" -o /dev/null -s ${url} >> ${output_file}
        else
            curl -w "%{time_total}\n" -o /dev/null -s ${url} >> ${output_file}
        fi
    done
}

# Function to monitor resource usage
monitor_resources() {
    local server=$1
    local duration=$2
    local output_file="results/${server}_resources.txt"
    
    echo "Monitoring resource usage for ${server}..."
    top -b -n ${duration} | grep -E "CPU|Mem|${server}" > ${output_file}
}

# Agregar función para calcular promedios de CPU y memoria
extract_resource_usage() {
    local resource_file=$1
    cpu_avg=$(grep -E -o "[0-9]+\.[0-9]+ id" "$resource_file" | awk '{sum+=100-$1} END {if(NR>0) print sum/NR; else print 0}')
    mem_avg=$(grep -E -o "[0-9]+\.[0-9]+ KiB Mem" "$resource_file" | awk '{sum+=$1} END {if(NR>0) print sum/NR; else print 0}')
    echo "$cpu_avg" "$mem_avg"
}

# Test parameters
CONCURRENCY_LEVELS=(1 10 50 100)
REQUESTS=1000
RESOURCE_MONITOR_DURATION=60

# Definir la ruta del archivo JSON de test en una variable
TEST_DATA_JSON="benchmark/test_data.json"

# Create test data file for POST requests
#echo '{"message": "Test message", "timestamp": "2024-03-20T12:00:00Z"}' > $TEST_DATA_JSON

# Laravel tests
echo "Starting Laravel tests..."

# POST tests
for concurrency in "${CONCURRENCY_LEVELS[@]}"; do
    run_ab_test "laravel" "http://localhost:8000/api/messages" ${concurrency} ${REQUESTS} "POST" "$TEST_DATA_JSON"
done
measure_response_time "laravel" "http://localhost:8000/api/messages" "POST" "$TEST_DATA_JSON"

monitor_resources "php" ${RESOURCE_MONITOR_DURATION}

# Node.js tests
echo "Starting Node.js tests..."

# POST tests
for concurrency in "${CONCURRENCY_LEVELS[@]}"; do
    run_ab_test "nodejs" "http://localhost:3000/api/messages" ${concurrency} ${REQUESTS} "POST" "$TEST_DATA_JSON"
done
measure_response_time "nodejs" "http://localhost:3000/api/messages" "POST" "$TEST_DATA_JSON"

monitor_resources "node" ${RESOURCE_MONITOR_DURATION}

# Generate summary report
echo "Generating summary report..."
echo "Performance Test Results Summary" > results/summary.txt
echo "==============================" >> results/summary.txt
echo "" >> results/summary.txt

# Process results and generate summary
for server in "laravel" "nodejs"; do
    echo "${server^} Results:" >> results/summary.txt
    echo "----------------" >> results/summary.txt
    
    # Procesar uso de recursos
    if [ "$server" = "laravel" ]; then
        resource_file="results/php_resources.txt"
    else
        resource_file="results/node_resources.txt"
    fi
    read cpu_avg mem_avg < <(extract_resource_usage "$resource_file")
    
    # Process POST results
    avg_response=$(awk '{ total += $1 } END { print total/NR }' results/${server}_POST_response_time.txt)
    failed_requests=$(grep "Failed requests" results/${server}_POST_ab_c1.txt | awk '{print $3}')
    rps=$(grep "Requests per second" results/${server}_POST_ab_c1.txt | awk '{print $4}')
    echo "POST Requests:" >> results/summary.txt
    echo "  - Tiempo de respuesta promedio: ${avg_response}s" >> results/summary.txt
    echo "  - Tasa de transferencia: ${rps} requests/segundo" >> results/summary.txt
    echo "  - Solicitudes fallidas: ${failed_requests}" >> results/summary.txt
    echo "  - Uso de CPU promedio: ${cpu_avg}%" >> results/summary.txt
    echo "  - Uso de memoria promedio: ${mem_avg} KiB" >> results/summary.txt
    
    echo "" >> results/summary.txt
done

echo "Benchmark completed. Results are available in the results directory." 