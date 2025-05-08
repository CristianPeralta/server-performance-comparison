# Apache Configuration

This directory contains Apache web server configuration files optimized for high performance to handle 700 requests per minute.

## Files

- `apache-custom.conf` - Main Apache configuration with performance optimizations

## Key Settings

The Apache configuration includes the following optimizations:

### MPM Prefork Settings
```
<IfModule mpm_prefork_module>
    StartServers          5
    MinSpareServers       5
    MaxRequestWorkers     150
    MaxConnectionsPerChild 0
</IfModule>
```

### MPM Event Settings
```
<IfModule mpm_event_module>
    StartServers          3
    MinSpareThreads       25
    MaxRequestWorkers     150
    MaxConnectionsPerChild 0
</IfModule>
```

### Directory Configuration
- Enables URL rewriting for Laravel's routing system
- Properly configures the document root at `/var/www/html/public`

### Cache Control
- Enables browser caching for static assets
- Sets appropriate expiration times for different file types:
  - JavaScript and CSS: 1 week
  - Images (jpg, jpeg, gif, png): 1 month

## Modules

The following Apache modules are required and enabled in the Dockerfile:
- `rewrite` - For Laravel routing
- `expires` - For cache control headers
- `headers` - For setting HTTP headers

## Usage

This configuration is applied during Docker container build by copying it to `/etc/apache2/sites-available/000-default.conf`.

