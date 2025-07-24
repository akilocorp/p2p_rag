# Use an official Python runtime as a parent image
FROM python:3.11-slim

# Install curl for health checks
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Set the working directory in the container
WORKDIR /app

# Copy and install requirements
COPY requirements.txt .
RUN pip install --no-cache-dir --timeout=100 -r requirements.txt

# Copy the rest of the application source code
COPY . .

# Expose the port the app runs on
EXPOSE 5000

# --- NEW COMMAND ---
# Run the app directly using the python interpreter
CMD ["python", "app.py"] 