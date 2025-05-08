FROM php:8.2-apache

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    libpng-dev \
    libonig-dev \
    libxml2-dev \
    zip \
    unzip

# Clear cache
RUN apt-get clean && rm -rf /var/lib/apt/lists/*

# Install PHP extensions
RUN docker-php-ext-install pdo_mysql mbstring exif pcntl bcmath gd

# Get latest Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Set working directory
WORKDIR /var/www/html

# Copy existing application directory
COPY . /var/www/html

# Configure Apache with optimized settings for 700 requests/minute
# Using a modular configuration approach:
# - apache-custom.conf: Main VirtualHost configuration
# - performance.conf: Performance optimization settings
RUN a2enmod rewrite expires headers

# Copy and enable configurations
COPY config/apache/apache-custom.conf /etc/apache2/sites-available/000-default.conf
COPY config/apache/performance.conf /etc/apache2/conf-available/performance.conf
RUN a2enconf performance

# Configure PHP with performance optimizations
# Sets memory limits, opcache, and other performance settings
COPY config/php/php.ini /usr/local/etc/php/conf.d/custom.ini

# Set proper permissions
RUN chown -R www-data:www-data /var/www/html \
    && chmod -R 755 /var/www/html/storage \
    && chmod -R 755 /var/www/html/bootstrap/cache

# Expose port 80
EXPOSE 80

# Start Apache
CMD ["apache2-foreground"]
