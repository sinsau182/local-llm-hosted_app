FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

# Feature toggles from the root master .env are passed as build args by
# docker-compose and baked into the bundle at build time (NEXT_PUBLIC_*).
ARG NEXT_PUBLIC_FEATURE_CHAT_PAGE=false
ARG NEXT_PUBLIC_FEATURE_DASHBOARD_TAB=false
ENV NEXT_PUBLIC_FEATURE_CHAT_PAGE=$NEXT_PUBLIC_FEATURE_CHAT_PAGE
ENV NEXT_PUBLIC_FEATURE_DASHBOARD_TAB=$NEXT_PUBLIC_FEATURE_DASHBOARD_TAB

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]
