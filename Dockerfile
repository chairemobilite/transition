# Transition Docker file

# Build json2capnp
# the capnp crate does not build on buster or older so we need to use a separate image
# since node does not provide a buster image.
# Added benefit of splitting the image
# We copy the executable later
FROM debian:trixie-slim AS json2capnpbuild
WORKDIR /app/services/json2capnp
COPY services/json2capnp ./
# Adding build-essential for jemalloc allocator
RUN apt-get update && apt-get -y --no-install-recommends install build-essential cargo ca-certificates
RUN cargo build


# Build Node app
FROM node:24-trixie
WORKDIR /app
# Install all the json package dependencies in an intermediary image. To do so, we copy each package.json files
# and run yarn install which will download all the listed packages in the image.
COPY package.json yarn.lock ./
COPY ./packages/chaire-lib-backend/package.json ./packages/chaire-lib-backend/package.json
COPY ./packages/chaire-lib-common/package.json ./packages/chaire-lib-common/package.json
COPY packages/chaire-lib-frontend packages/chaire-lib-frontend
COPY packages/transition-common packages/transition-common
COPY packages/transition-backend packages/transition-backend
COPY packages/transition-frontend packages/transition-frontend
# Add a 300 seconds timeout to avoid build failures in docker hub, which seems to be an acceptable workaround (see for example https://github.com/yarnpkg/yarn/issues/5540)
RUN yarn config set network-timeout 300000
RUN yarn install

# Setup the example as a default configuration for the image
COPY .env.docker /app/.env

#TODO We probably need to do something different for the projects configuration directories
# the docker-compose file have an example of using volume for part of a project

# Copy in json2capnp
COPY --from=json2capnpbuild /app/services/json2capnp/target/debug/json2capnp services/json2capnp/

# Copy in trRouting and osrm binaries
# For trRouting
RUN apt-get update && apt-get -y --no-install-recommends install capnproto libboost-regex1.83.0 libboost-filesystem1.83.0 libboost-iostreams1.83.0 libboost-thread1.83.0 libboost-date-time1.83.0 libboost-serialization1.83.0 libboost-program-options1.83.0 libspdlog1.15 libmemcached11 libmemcachedutil2

# For OSRM
RUN apt-get -y --no-install-recommends install libboost-chrono1.83.0 liblua5.4-0 libtbb12
COPY --from=chairemobilite/trrouting:latest /usr/local/bin/trRouting /usr/local/bin/
COPY --from=greenscientist/osrm-backend:trixie /usr/local/bin/osrm-* /usr/local/bin/

#From OSRM dockerfile, make sure tools work
RUN /usr/local/bin/osrm-extract --help && \
    /usr/local/bin/osrm-routed --help && \
    /usr/local/bin/osrm-contract --help && \
    /usr/local/bin/osrm-partition --help && \
    /usr/local/bin/osrm-customize --help

RUN /usr/local/bin/trRouting --help

# Add memcached
RUN apt-get install -y memcached

# Copy the necessary files for compilation   
COPY ./configs /app/configs
COPY ./packages /app/packages
RUN yarn compile

# Copy the rest. (node_modules are excluded in .dockerignore)
COPY . /app

# Start json2capnp -> Relies on manually creating cache directory before
# Start Node app
CMD sh -c "cd services/json2capnp && pwd && ./json2capnp 2000 /app/examples/runtime/cache/demo_transition > /app/json2capnp.log &" && yarn build:prod && yarn start
EXPOSE 8080
