#!/usr/bin/sh

/app/services/json2capnp/json2capnp 2000 /app/examples/runtime/cache/demo_transition > /app/json2capnp.log &

yarn compile:dev&
yarn build:dev&
yarn start
