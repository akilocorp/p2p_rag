#!/bin/bash

# RAG Platform Deployment Script for EC2
# This script should be run on the EC2 instance to set up the environment

set -e  # Exit on any error

echo "🚀 Starting RAG Platform deployment setup..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    print_error "Please don't run this script as root"
    exit 1
fi

# Update system packages
print_status "Updating system packages..."
sudo apt-get update -y

# Install Docker if not already installed
if ! command -v docker &> /dev/null; then
    print_status "Installing Docker..."
    sudo apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update -y
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io
    sudo usermod -aG docker $USER
    print_status "Docker installed successfully"
else
    print_status "Docker is already installed"
fi

# Install Docker Compose if not already installed
if ! command -v docker-compose &> /dev/null; then
    print_status "Installing Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    print_status "Docker Compose installed successfully"
else
    print_status "Docker Compose is already installed"
fi

# Install AWS CLI if not already installed
if ! command -v aws &> /dev/null; then
    print_status "Installing AWS CLI..."
    curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
    sudo apt-get install -y unzip
    unzip awscliv2.zip
    sudo ./aws/install
    rm -rf aws awscliv2.zip
    print_status "AWS CLI installed successfully"
else
    print_status "AWS CLI is already installed"
fi

# Install Git if not already installed
if ! command -v git &> /dev/null; then
    print_status "Installing Git..."
    sudo apt-get install -y git
    print_status "Git installed successfully"
else
    print_status "Git is already installed"
fi

# Create application directory
APP_DIR="/home/$USER/rag_platform"
if [ ! -d "$APP_DIR" ]; then
    print_status "Creating application directory..."
    mkdir -p "$APP_DIR"
fi

# Set up log rotation for Docker containers
print_status "Setting up log rotation for Docker..."
sudo tee /etc/docker/daemon.json > /dev/null <<EOF
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF

# Restart Docker to apply log rotation settings
print_status "Restarting Docker service..."
sudo systemctl restart docker

# Create systemd service for automatic startup
print_status "Creating systemd service for RAG Platform..."
sudo tee /etc/systemd/system/rag-platform.service > /dev/null <<EOF
[Unit]
Description=RAG Platform Docker Compose
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$APP_DIR
ExecStart=/usr/local/bin/docker-compose -f docker-compose.prod.yml up -d
ExecStop=/usr/local/bin/docker-compose -f docker-compose.prod.yml down
TimeoutStartSec=0
User=$USER
Group=$USER

[Install]
WantedBy=multi-user.target
EOF

# Enable the service
sudo systemctl daemon-reload
sudo systemctl enable rag-platform.service

print_status "✅ EC2 setup completed successfully!"
print_warning "⚠️  Please note:"
echo "1. You need to configure AWS credentials using 'aws configure'"
echo "2. Make sure your GitHub repository secrets are properly set"
echo "3. The application will start automatically on system boot"
echo "4. You may need to log out and log back in for Docker group permissions to take effect"

print_status "🎉 Your EC2 instance is now ready for CI/CD deployments!"
