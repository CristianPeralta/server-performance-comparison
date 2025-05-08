# Laravel Configuration Directory

This directory contains configuration files for the Laravel application environment running on Apache and PHP.

## Directory Structure

- `/apache` - Apache web server configuration files optimized for high performance
- `/php` - PHP configuration files with performance tuning
- Other files in this directory are Laravel framework configurations

## Laravel Configurations

The Laravel framework configuration files in this directory control various aspects of the application:

- `app.php` - Application configuration
- `auth.php` - Authentication settings
- `database.php` - Database connections
- `cache.php` - Cache settings
- `queue.php` - Queue system configuration
- `mail.php` - Mail server settings
- `logging.php` - Log configuration
- And other framework-specific settings

## Performance Optimizations

The Laravel application has been optimized for handling high traffic loads:

- Route rate limiting is set to 700 requests per minute in `app/Providers/RouteServiceProvider.php`
- Database connections are properly pooled
- Cache is configured for optimal performance

## Usage

These configuration files are automatically loaded when the Docker container is built using the Dockerfile in the parent directory.

