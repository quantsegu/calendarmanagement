FROM node:20-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

# `npm ci` runs `prisma generate` in `postinstall`, so Prisma needs the schema
# files available during the dependency install step.
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN mkdir -p src/generated

RUN npm ci

COPY . .

RUN npm run build

RUN mkdir -p /data

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "run", "start"]
