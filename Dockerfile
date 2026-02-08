FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN npm run build

# Create data directory
RUN mkdir -p /app/data
VOLUME ["/app/data"]

# Start script - ensure data dir exists before prisma
CMD ["sh", "-c", "mkdir -p /app/data && npx prisma db push --skip-generate && node dist/index.js"]
