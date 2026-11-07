
FROM python:3.12-alpine AS builder

# Install system dependencies required to build Python packages
RUN apk add --no-cache gcc musl-dev postgresql-dev

WORKDIR /app

# Install Python dependencies into wheels
COPY requirements.txt .
RUN pip wheel --no-cache-dir --no-deps -w /wheels -r requirements.txt


FROM python:3.12-alpine AS runtime

# Create a non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Install runtime dependencies and curl
RUN apk add --no-cache libpq curl

# Install Python dependencies
COPY --from=builder /wheels /wheels
RUN pip install --no-cache-dir /wheels/* && rm -rf /wheels

# Copy application code
COPY . .

# Create directories and grant permissions
RUN mkdir -p /app/staticfiles /app/media && \
    chown -R appuser:appgroup /app/staticfiles /app/media

# Use non-root user
USER appuser

# Expose Django port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=10s --timeout=5s --retries=5 --start-period=30s \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health/', timeout=5)" || exit 1

# Run migrations, collect static files, and start Gunicorn
CMD ["sh", "-c", "python manage.py migrate --noinput && python manage.py collectstatic --noinput && gunicorn config.wsgi:application --bind 0.0.0.0:8000"]
