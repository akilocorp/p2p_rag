# Stage 1: Builder Stage - Install dependencies
# Use a specific, stable Python version as the base image for building
FROM python:3.11-slim

# Set the working directory inside this builder container
WORKDIR /app

# Copy only the requirements file first.
# This step's cache will only be invalidated if requirements.txt changes.
COPY requirements.txt .
RUN pip install --no-cache-dir --timeout=100 -r requirements.txt
# Install dependencies.
# --no-cache-dir prevents pip from storing its cache within this layer, reducing size.
# The '&& rm -rf ~/.cache/pip' cleans up any residual pip cache files after installation.
RUN pip install --no-cache-dir -r requirements.txt \
    && rm -rf ~/.cache/pip

# Stage 2: Runtime Stage - Copy only what's needed for the final application
# Use a fresh, clean base image for the final, smaller runtime image.
# It's good practice to use the same base or an even smaller one like 'python:3.11-slim-buster'
# if 'slim' is too large, but 'slim' is usually fine.
# Copy the installed Python packages from the 'builder' stage to the final image.
# This avoids re-running pip install in the final image
# Copy the rest of your application source code.
# This layer will be rebuilt only if your application code changes,
# but the dependency layer (copied from 'builder') remains cached.
COPY . .

# Expose the port the app runs on
EXPOSE 5000

# Run the app directly using the python interpreter
CMD ["python", "app.py"]
