FROM node:22-alpine

WORKDIR /app

# Install build tools for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++

# Copy package files and install dependencies
COPY package.json package-lock.json* ./
RUN npm install --production=false

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Create data volume for persistent storage (SQLite DB + brain files)
RUN mkdir -p /data
VOLUME /data

# Set storage directory
ENV STORAGE_DIR=/data
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["npx", "tsx", "server/index.ts"]
