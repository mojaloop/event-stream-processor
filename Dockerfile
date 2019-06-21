FROM node:10.15.3-alpine
USER root

WORKDIR /opt/event-stream-processor

RUN apk --no-cache add git
RUN apk add --no-cache -t build-dependencies make gcc g++ python libtool autoconf automake \
    && cd $(npm root -g)/npm \
    && npm config set unsafe-perm true \
    && npm install -g node-gyp

COPY package.json package-lock.json* /opt/event-stream-processor/

RUN npm install --production && \
  npm uninstall -g npm

COPY src /opt/event-stream-processor/src
COPY config /opt/event-stream-processor/config
COPY app.js /opt/event-stream-processor/
# COPY docs /opt/central-event-processor/docs

RUN apk del build-dependencies

EXPOSE 3082
CMD node app.js
