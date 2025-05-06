#!/bin/bash

# Configuration
LARAVEL_URL="http://localhost:8000/api/messages"
NODEJS_URL="http://localhost:3000/api/messages"
CONCURRENCY=100
REQUESTS=1000

echo "Starting performance comparison..."
echo "--------------------------------"

# Test Laravel
echo "Testing Laravel + Apache..."
ab -n $REQUESTS -c $CONCURRENCY $LARAVEL_URL > laravel_results.txt

# Test Node.js
echo "Testing Node.js..."
ab -n $REQUESTS -c $CONCURRENCY $NODEJS_URL > nodejs_results.txt

echo "--------------------------------"
echo "Results have been saved to laravel_results.txt and nodejs_results.txt" 