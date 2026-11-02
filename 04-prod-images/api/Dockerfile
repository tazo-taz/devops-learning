FROM node:24
WORKDIR /app
COPY package*.json ./
RUN --mount=type=secret,id=ca,target=/tmp/ca.crt \
    NODE_EXTRA_CA_CERTS=/tmp/ca.crt npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "start:prod"]
