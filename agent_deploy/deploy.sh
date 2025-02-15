#!/bin/bash

# Install Docker and Docker Compose
sudo apt-get update
sudo apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

# Add Docker's official GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Set up the stable repository
echo \
  "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install X virtual framebuffer for browser
sudo apt-get install -y xvfb

# Create app directory
sudo mkdir -p /app
sudo chown -R ubuntu:ubuntu /app

# Copy files to app directory
cp -r * /app/

# Create .env file
cat > /app/.env << EOL
# Redis Configuration
REDIS_PASSWORD=${REDIS_PASSWORD}

# OpenAI Configuration
OPENAI_API_KEY=${OPENAI_API_KEY}

# Agent Configuration
AGENT_EMAIL=${AGENT_EMAIL}
AGENT_PASSWORD=${AGENT_PASSWORD}
AGENT_UID=${AGENT_UID}

# Firebase Configuration
FIREBASE_API_KEY=${FIREBASE_API_KEY}
FIREBASE_AUTH_DOMAIN=${FIREBASE_AUTH_DOMAIN}
FIREBASE_PROJECT_ID=${FIREBASE_PROJECT_ID}
FIREBASE_STORAGE_BUCKET=${FIREBASE_STORAGE_BUCKET}
EOL

# Start services
cd /app
sudo docker-compose up -d --build 