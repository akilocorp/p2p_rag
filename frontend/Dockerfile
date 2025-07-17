# --- Stage 1: Build the React App ---
# --- Stage 1: Build the React App ---
FROM node:20-alpine AS builder

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json to leverage Docker cache
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application source code
COPY . .

# Set the API URL environment variable
ARG API_URL
ENV VITE_API_URL=${API_URL}

# Build the production-ready static files
RUN npm run build

# --- Stage 2: Serve the App with Nginx ---
FROM nginx:stable-alpine

# Copy the build output from the builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy our custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# The default Nginx command will start the server
CMD ["nginx", "-g", "daemon off;"]