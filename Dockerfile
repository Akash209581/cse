FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 4867

ENV PORT=4867
ENV HOST=0.0.0.0

CMD ["node", "server.js"]
