FROM node:20-alpine AS builder
WORKDIR /app

ARG VITE_SERVER_URL=http://localhost:3001
ENV VITE_SERVER_URL=$VITE_SERVER_URL

COPY package.json ./
RUN npm install

COPY . .
RUN npm run build

# Stage 2: nginx serve static
FROM nginx:stable-alpine
COPY --from=builder /app/dist /usr/share/nginx/html

# Config SPA - dùng port 80 cố định, Railway map qua domain
RUN rm /etc/nginx/conf.d/default.conf && \
    printf 'server {\n\
  listen 80;\n\
  root /usr/share/nginx/html;\n\
  index index.html;\n\
  gzip on;\n\
  gzip_types text/plain text/css application/javascript application/json;\n\
  location / {\n\
    try_files $uri $uri/ /index.html;\n\
  }\n\
}\n' > /etc/nginx/conf.d/app.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
