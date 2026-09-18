# Arguments
ARG NODE_VERSION="24.21.0-alpine3.24"
# NOTE: Ensure you set NODE_VERSION Build Argument as follows...
#
#  export NODE_VERSION="$(cat .nvmrc)-alpine" \
#  docker build \
#    --build-arg NODE_VERSION=$NODE_VERSION \
#    -t mojaloop/event-stream-processor:local \
#    . \
#

# Build Image
FROM node:${NODE_VERSION} as builder
USER root

WORKDIR /opt/app

RUN apk add --no-cache --virtual .build-deps \
    autoconf automake bash g++ gcc git libtool make openssl-dev python3

COPY package.json package-lock.json* /opt/app/

# Production dependencies only, with lifecycle scripts disabled; node-rdkafka is
# then rebuilt explicitly so its native bindings are compiled in this stage.
RUN npm ci --omit=dev --ignore-scripts
RUN npm rebuild node-rdkafka

RUN apk del .build-deps

COPY src /opt/app/src
COPY config /opt/app/config

FROM node:${NODE_VERSION}

WORKDIR /opt/app

# Create empty log file & link stdout to the application log file
RUN mkdir ./logs && touch ./logs/combined.log
# Links combined to stdout
RUN ln -sf /dev/stdout ./logs/combined.log

# Create a non-root user:app-user
RUN adduser -D app-user
USER app-user

COPY --chown=app-user --from=builder /opt/app .

EXPOSE 3082
CMD ["npm", "start"]