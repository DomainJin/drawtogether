FROM node:20-alpine AS base
WORKDIR /app

# Cài dependencies trước (cache layer)
COPY package.json ./
RUN npm install --omit=dev

# Copy source
COPY src ./src

EXPOSE 3001
CMD ["node", "src/index.js"]
