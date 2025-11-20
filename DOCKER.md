# Docker Build and Deployment Guide

## Build Docker Image

```bash
# Build the image
docker build -t bowhead-whale:latest .

# Or with a specific tag
docker build -t bowhead-whale:v1.0.0 .
```

## Run with Docker

```bash
# Run the container
docker run -d \
  --name bowhead-whale \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e PORT=3000 \
  bowhead-whale:latest
```

## Run with Docker Compose

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Multi-stage Build

The Dockerfile uses a multi-stage build process:

1. **Frontend Builder**: Builds the React application using Vite
2. **Backend Builder**: Prepares backend dependencies
3. **Final Image**: Combines built frontend and backend in a minimal Node.js Alpine image

## Image Size Optimization

- Uses Alpine Linux for smaller image size
- Multi-stage build to exclude build dependencies
- Only production dependencies in final image
- Non-root user for security

## Health Check

The container includes a health check endpoint at `/api/health` that Docker can use to monitor container health.

## Environment Variables

You can override environment variables when running:

```bash
docker run -d \
  --name bowhead-whale \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e SUI_NETWORK=testnet \
  bowhead-whale:latest
```

## Troubleshooting

### View logs
```bash
docker logs bowhead-whale
```

### Access container shell
```bash
docker exec -it bowhead-whale sh
```

### Rebuild without cache
```bash
docker build --no-cache -t bowhead-whale:latest .
```

