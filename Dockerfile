# Dockerfile
FROM python:3.10-slim

# Install system dependencies for OpenCV and Deno
RUN apt-get update && apt-get install -y \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgl1-mesa-glx \
    curl \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# Copy and install Python dependencies
COPY apps/api/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Install Deno
RUN curl -fsSL https://deno.land/x/install/install.sh | sh

# Set environment variables for Deno
ENV DENO_INSTALL="/root/.deno"
ENV PATH="$DENO_INSTALL/bin:$PATH"

# Copy the rest of the application code
COPY . /app

# Expose the port Flask will run on
EXPOSE 5000

# Command to run the Flask application
CMD [ "python", "apps/api/src/app.py" ]
