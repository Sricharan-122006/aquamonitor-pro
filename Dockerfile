FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install dependencies first (leverage Docker layer caching)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application source code
COPY . .

# Expose default application port
EXPOSE 5000

# Set environment
ENV NODE_ENV=production
ENV PORT=5000

# Start application
CMD ["node", "server.js"]
