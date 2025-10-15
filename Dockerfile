# Dockerfile used for both the frontend dev server and push backend.
FROM node:20-alpine

WORKDIR /app

# Install dependencies separately to leverage Docker layer caching.
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the source code.
COPY . .

ENV NODE_ENV=development

# Expose the ports used by the Vite dev server and the push backend.
EXPOSE 5173 4000

# Default command runs both servers for convenience. Individual services in
# docker-compose override this with the specific process they need.
CMD ["npm", "run", "dev:full"]
