# RAG Platform CI/CD Deployment Guide

This guide will help you set up CI/CD for your RAG Platform using GitHub Actions and AWS EC2.

## 🏗️ Architecture Overview

- **Source Code**: GitHub Repository
- **CI/CD**: GitHub Actions
- **Container Registry**: AWS ECR (Elastic Container Registry)
- **Deployment Target**: AWS EC2 Instance
- **Application**: Docker Compose with Backend (Flask) + Frontend (React/Nginx)

## 📋 Prerequisites

1. **AWS Account** with the following:
   - EC2 instance (Ubuntu 20.04+ recommended)
   - ECR repositories created
   - IAM user with appropriate permissions

2. **GitHub Repository** with your RAG Platform code

3. **Domain/IP** for accessing your application

## 🚀 Step-by-Step Setup

### Step 1: Prepare Your EC2 Instance

1. **Connect to your EC2 instance**:
   ```bash
   ssh -i your-key.pem ubuntu@your-ec2-ip
   ```

2. **Run the deployment setup script**:
   ```bash
   # Download and run the setup script
   curl -o deploy.sh https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPO/main/deploy.sh
   chmod +x deploy.sh
   ./deploy.sh
   ```

3. **Configure AWS credentials**:
   ```bash
   aws configure
   # Enter your AWS Access Key ID, Secret Access Key, and region (us-east-2)
   ```

4. **Log out and log back in** to apply Docker group permissions.

### Step 2: Set Up GitHub Secrets

In your GitHub repository, go to **Settings > Secrets and variables > Actions** and add these secrets:

#### Required Secrets:
- `AWS_ACCESS_KEY_ID`: Your AWS access key ID
- `AWS_SECRET_ACCESS_KEY`: Your AWS secret access key
- `EC2_HOST`: Your EC2 instance public IP address
- `EC2_USER`: EC2 username (usually `ubuntu` for Ubuntu instances)
- `EC2_SSH_KEY`: Your EC2 private key content (the entire .pem file content)

#### How to add EC2_SSH_KEY:
1. Open your `.pem` file in a text editor
2. Copy the entire content (including `-----BEGIN RSA PRIVATE KEY-----` and `-----END RSA PRIVATE KEY-----`)
3. Paste it as the value for `EC2_SSH_KEY` secret

### Step 3: Prepare Your Backend Environment

1. **Create/Update backend/.env file** on your EC2 instance:
   ```bash
   # On your EC2 instance
   cd /home/ubuntu/rag_platform/backend
   nano .env
   ```

2. **Add your environment variables**:
   ```env
   # Database Configuration
   MONGO_URI=your_mongodb_connection_string
   MONGO_DB_NAME=your_database_name
   USER=your_user_collection_name
   
   # OpenAI Configuration
   OPENAI_API_KEY=your_openai_api_key
   
   # JWT Configuration
   SECRET_KEY=your_secret_key
   
   # Email Configuration (if using)
   MAIL_SERVER=smtp.gmail.com
   MAIL_PORT=587
   MAIL_USE_TLS=true
   MAIL_USERNAME=your_email@gmail.com
   MAIL_PASSWORD=your_app_password
   MAIL_DEFAULT_SENDER=your_email@gmail.com
   ```

### Step 4: Update ECR Repository URLs (if needed)

If your ECR repository URLs are different, update them in:

1. **docker-compose.yml** (for local development)
2. **docker-compose.prod.yml** (for production)
3. **.github/workflows/deploy.yml** (GitHub Actions workflow)

Current ECR registry: `235639741719.dkr.ecr.us-east-2.amazonaws.com`

### Step 5: Test the Deployment

1. **Push your code to the main branch**:
   ```bash
   git add .
   git commit -m "Add CI/CD pipeline"
   git push origin main
   ```

2. **Monitor the GitHub Actions workflow**:
   - Go to your repository on GitHub
   - Click on the "Actions" tab
   - Watch the deployment process

3. **Verify the deployment**:
   ```bash
   # On your EC2 instance, check if containers are running
   docker ps
   
   # Check application logs
   docker-compose -f docker-compose.prod.yml logs -f
   ```

4. **Access your application**:
   - Frontend: `http://your-ec2-ip` (port 80)
   - Backend API: `http://your-ec2-ip:5000`
   - Health check: `http://your-ec2-ip:5000/health`

## 🔧 Configuration Files Explained

### GitHub Actions Workflow (`.github/workflows/deploy.yml`)
- Triggers on push to main/master branch
- Builds Docker images for backend and frontend
- Pushes images to AWS ECR
- Deploys to EC2 using SSH

### Production Docker Compose (`docker-compose.prod.yml`)
- Uses pre-built images from ECR
- Includes health checks and restart policies
- Optimized for production environment

### Development Docker Compose (`docker-compose.yml`)
- Builds images locally
- Used for development and testing

## 🛠️ Troubleshooting

### Common Issues:

1. **GitHub Actions fails with ECR login error**:
   - Verify AWS credentials in GitHub secrets
   - Check ECR repository exists and permissions are correct

2. **SSH connection fails**:
   - Verify EC2_HOST, EC2_USER, and EC2_SSH_KEY secrets
   - Ensure EC2 security group allows SSH (port 22) from GitHub Actions IPs

3. **Containers fail to start**:
   - Check environment variables in backend/.env
   - Verify MongoDB connection string
   - Check Docker logs: `docker-compose -f docker-compose.prod.yml logs`

4. **Application not accessible**:
   - Check EC2 security group allows HTTP (port 80) and custom ports (5000)
   - Verify containers are running: `docker ps`

### Useful Commands:

```bash
# Check container status
docker ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Restart services
docker-compose -f docker-compose.prod.yml restart

# Pull latest images manually
docker-compose -f docker-compose.prod.yml pull

# Clean up old images
docker image prune -f

# Check system service status
sudo systemctl status rag-platform.service
```

## 🔄 Manual Deployment

If you need to deploy manually without GitHub Actions:

```bash
# On your EC2 instance
cd /home/ubuntu/rag_platform

# Pull latest code
git pull origin main

# Login to ECR
aws ecr get-login-password --region us-east-2 | docker login --username AWS --password-stdin 235639741719.dkr.ecr.us-east-2.amazonaws.com

# Pull latest images
docker-compose -f docker-compose.prod.yml pull

# Restart services
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d
```

## 📊 Monitoring

- **Health Checks**: Both frontend and backend have health check endpoints
- **Logs**: Centralized logging with log rotation configured
- **Auto-restart**: Containers automatically restart on failure
- **System Service**: Application starts automatically on system boot

## 🔐 Security Considerations

1. **Environment Variables**: Never commit sensitive data to Git
2. **SSH Keys**: Use GitHub secrets for SSH keys
3. **AWS Credentials**: Use IAM roles with minimal required permissions
4. **Firewall**: Configure EC2 security groups properly
5. **SSL/TLS**: Consider adding HTTPS with Let's Encrypt (not included in this setup)

## 📈 Scaling Considerations

For production scaling, consider:
- Load balancer (AWS ALB/ELB)
- Multiple EC2 instances
- Container orchestration (ECS/EKS)
- Database clustering
- CDN for static assets
- Monitoring and alerting (CloudWatch)

---

🎉 **Congratulations!** Your RAG Platform now has a complete CI/CD pipeline. Every push to the main branch will automatically build, test, and deploy your application to EC2.
