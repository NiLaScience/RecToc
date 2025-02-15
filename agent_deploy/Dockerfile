FROM python:3.11-slim

WORKDIR /app

# Install system dependencies including those needed for Playwright
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    wget \
    xvfb \
    libgbm1 \
    libnspr4 \
    libnss3 \
    libxss1 \
    libasound2 \
    fonts-liberation \
    libappindicator3-1 \
    libatk-bridge2.0-0 \
    libatspi2.0-0 \
    libgtk-3-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first to leverage Docker cache
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright browsers
RUN playwright install chromium
RUN playwright install-deps chromium

# Install additional packages needed for agent authentication
RUN pip install --no-cache-dir python-dotenv requests

# Copy application code
COPY . .

# Create directory for Firebase credentials
RUN mkdir -p /app/credentials

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app
ENV DISPLAY=:99

# Create a script to start Xvfb and the application
RUN echo '#!/bin/bash\nXvfb :99 -screen 0 1024x768x16 &\nsleep 1\nexec "$@"' > /usr/local/bin/entrypoint.sh \
    && chmod +x /usr/local/bin/entrypoint.sh

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["uvicorn", "api_server:app", "--host", "0.0.0.0", "--port", "8000"] 