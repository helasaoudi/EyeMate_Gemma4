# syntax=docker/dockerfile:1.7

### Stage 1 – install dependencies
FROM node:20-alpine AS deps

WORKDIR /app

# Install build prerequisites required by Expo's web export pipeline
RUN apk add --no-cache python3 make g++ libc6-compat git

# Install all JS dependencies (ci = clean install using package-lock)
COPY package*.json ./
RUN npm ci

# Copy the rest of the project
COPY . .

### Stage 2 – build the Expo web bundle
FROM node:20-alpine AS builder
WORKDIR /app

# Re-use the dependency layer to avoid reinstalling packages
COPY --from=deps /app /app

# Disable doctor prompts and ensure non-interactive export
ENV EXPO_NO_DOCTOR=1 \
    EXPO_USE_FAST_RESOLVER=1 \
    CI=1

# Produce a static web build in /app/dist using the local Expo CLI (via npx)
RUN npx --yes expo export --platform web --output-dir dist --clear

### Stage 3 – serve the bundle with nginx
FROM nginx:alpine AS runner

# Copy build artifacts from previous stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Optionally override nginx configuration if needed (uncomment to use custom config)
# COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

