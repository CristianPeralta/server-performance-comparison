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

The benchmark directory contains scripts to test both servers under various conditions:
- Load testing
- Response time measurements
- Resource usage monitoring
- Database performance comparison

Run the benchmarks using:
```bash
cd benchmark
./run_benchmarks.sh
```

## Results

Benchmark results will be stored in the `benchmark/results` directory, including:
- Response time graphs
- Resource usage charts
- Database performance metrics
- Load test results

## Contributing

Feel free to submit issues and enhancement requests.
