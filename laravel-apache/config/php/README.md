# PHP Configuration

This directory contains PHP configuration optimized for performance to support 700 requests per minute.

## Files

- `php.ini` - Custom PHP configuration with performance optimizations

## Key Settings

The PHP configuration includes the following optimizations:

### Resource Limits
```
max_execution_time = 300
memory_limit = 256M
max_input_time = 300
post_max_size = 64M
upload_max_filesize = 64M
```

### OpCache Settings
```
opcache.enable = 1
opcache.memory_consumption = 128
opcache.interned_strings_buffer = 8
opcache.max_accelerated_files = 4000
opcache.revalidate_freq = 60
opcache.fast_shutdown = 1
opcache.enable_cli = 1
```

### Path Cache
```
realpath_cache_size = 4096K
realpath_cache_ttl = 120
```

### Session Settings
```
session.gc_maxlifetime = 1440
session.cookie_lifetime = 0
```

### Error Handling
- Error reporting is set to hide deprecated warnings in production
- Errors are logged but not displayed to users
- Error logs are directed to `/var/log/php_errors.log`

## Usage

This configuration is applied during Docker container build by copying it to `/usr/local/etc/php/conf.d/custom.ini`.

