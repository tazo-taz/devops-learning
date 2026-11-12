FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN --mount=type=secret,id=ca,target=/tmp/ca.crt \
    NODE_EXTRA_CA_CERTS=/tmp/ca.crt npm ci
COPY . .
RUN npm run build

FROM build AS dev
CMD ["npm", "run", "start:dev"]

FROM node:24-alpine AS prod
WORKDIR /app
COPY package*.json ./
RUN --mount=type=secret,id=ca,target=/tmp/ca.crt \
    NODE_EXTRA_CA_CERTS=/tmp/ca.crt npm ci --omit=dev
COPY --from=build /app/dist ./dist
EXPOSE 3000
# still root here: prepare a folder the app may write to
RUN mkdir /app/uploads && chown -R node:node /app/uploads
# from here on everything runs as node
USER node
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "dist/main"]
# CMD ["npm", "run", "start:prod"]