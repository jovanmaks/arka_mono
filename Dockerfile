# Dockerfile
FROM python:3.10.12-slim-bullseye

# Add retry logic for apt and configure apt for more reliable downloads
RUN echo "APT::Acquire::Retries \"3\";" > /etc/apt/apt.conf.d/80-retries && \
    echo "Acquire::http::Timeout \"10\";" > /etc/apt/apt.conf.d/99timeout && \
    echo "Acquire::https::Timeout \"10\";" >> /etc/apt/apt.conf.d/99timeout

# Install system dependencies with retry mechanism
RUN apt-get update && \
    for i in {1..3}; do apt-get install -y \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgl1-mesa-glx \
    curl \
    unzip \
    supervisor && break || sleep 15; done && \
    rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# Create uploads directory and set permissions
RUN mkdir -p /app/apps/api/src/uploads && \
    chmod 777 /app/apps/api/src/uploads

# Copy and install Python dependencies
COPY apps/api/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Install Deno with retry mechanism
RUN for i in {1..3}; do \
    curl -fsSL https://deno.land/x/install/install.sh | sh && break || sleep 15; \
    done

# Set environment variables for Deno
ENV DENO_INSTALL="/root/.deno"
ENV PATH="$DENO_INSTALL/bin:$PATH"
ENV HOST=0.0.0.0

# Copy the rest of the application code
COPY . /app

# Build the frontend
RUN deno task web:build

# Setup supervisor
COPY supervisor.conf /etc/supervisor/conf.d/

# Expose ports for both services
EXPOSE 5000 8000

# Start supervisor to manage both processes
CMD ["/usr/bin/supervisord", "-n"]
