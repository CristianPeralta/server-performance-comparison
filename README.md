# Server Performance Comparison

This project compares the performance of two different server stacks:
1. Laravel (PHP) with Apache and MySQL
2. Node.js with MongoDB

## Project Structure

```
.
├── benchmark/           # Benchmark scripts and results
├── laravel-apache/     # Laravel application with Apache and MySQL
├── nodejs/            # Node.js application with MongoDB
└── README.md
```

## Requirements

### Laravel Stack
- PHP 8.1+
- Apache 2.4+
- MySQL 8.0+
- Composer

### Node.js Stack
- Node.js 18+
- MongoDB 6.0+
- npm

## Setup Instructions

### Laravel Setup
1. Navigate to the laravel-apache directory
2. Run `composer install`
3. Copy `.env.example` to `.env` and configure your database
4. Run `php artisan migrate`
5. Start Apache server

### Node.js Setup
1. Navigate to the nodejs directory
2. Run `npm install`
3. Copy `.env.example` to `.env` and configure your MongoDB connection
4. Start the server with `npm start`

## Running Benchmarks

The `benchmark` directory contains scripts to evaluate both servers under different conditions:
- Load testing
- Response time measurements
- Resource usage monitoring (CPU and memory via Docker)
- Database performance comparison

The main script is `benchmark_script.sh`, which supports two benchmark modes:
- `ab` (Apache Benchmark)
- `jmeter` (default)

### Usage Example

From the `benchmark` folder:
```bash
cd benchmark
# Uses JMeter by default
./benchmark_script.sh
# To use Apache Benchmark (ab)
./benchmark_script.sh ab
```

The script runs benchmarks for both Laravel and Node.js, monitoring the resource usage of the associated Docker containers (`laravel-app`, `nodejs-app`).

### Available Utilities
- `utils.sh`: contains functions to analyze resource usage (`analyze_usage`), run benchmarks (`run_benchmark`, `run_jmeter`), and extract metrics from the results.
- Test payloads are located in `benchmark/data/`.
- Results are stored in `benchmark/results/`.

### Results

The benchmark results are stored in the `benchmark/results` directory, including:
- Metrics summaries (`summary.txt`)
- ab/jmeter output files
- Resource usage CSV files

You can review the overall summary in `benchmark/results/summary.txt` after each run.

## Contributing

Feel free to submit issues and enhancement requests.
