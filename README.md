# Transition
[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fchairemobilite%2Ftransition.svg?type=shield)](https://app.fossa.com/projects/git%2Bgithub.com%2Fchairemobilite%2Ftransition?ref=badge_shield)

Transition is a modern new approach to transit planning. This repo is a Node/React web application to model, simulate and plan public transit and alternative transportation.

See http://transition.city/


[Definitions and symbols used in the code and in the interface](https://www.overleaf.com/read/dtxfhttxgjrx)

For Ubuntu users: [complete step-by-step development environment setup procedure](docs/setupDevEnvironmentUbuntu.md)

## Stand alone Desktop installation

For users only interested in running Transition, without manually installing all the dependencies, follow these [step-by-step instructions to set up Transition using Docker Desktop](docs/runWithDocker.md).

## Non-Node Dependencies

* [PostgreSQL](https://www.postgresql.org/) 10+ with [PostGIS](https://postgis.net/)
* [OSRM](https://github.com/Project-OSRM/osrm-backend/): It is the routing engine used by Transition, to calculate the routes for various modes: for example walking, cycling, driving, bus in urban setting, suburban bus, etc.
* [trRouting](https://github.com/chairemobilite/trRouting/): An open source routing engine to calculate the route between an origin and a destination, or to calculate accessibility from/to a point, using public transit network. It is the main engine used for public transit simulations.
* yarn: [debian/ubuntu](https://classic.yarnpkg.com/en/docs/install/#debian-stable) or [macOS](https://classic.yarnpkg.com/en/docs/install/#mac-stable)
* [Rust](https://www.rust-lang.org/): It is used to run the json2capnp cache service which makes the application much faster if there's a lot of transit data.

## Installation

* Install dependencies:

For Ubuntu 20.04 or 22.04 users, use:
```
sudo apt-get install postgresql postgis lua5.3 liblua5.3-dev \
capnproto libcapnp-dev postgresql-postgis postgresql-postgis-scripts rustc cargo
```
* Create a `.env` file in the project root directory (you can copy the `.env.example` file) and setup the project
* `yarn install` or just `yarn`: Will download the packages required by the application
* `yarn compile`: Convert the typescript files to javascript
* `yarn setup`: Run this command to setup the database for the current project
* `yarn migrate`: Update the database schema with latest changes. This can be run whenever the source code is updated
* Optionally `yarn create-user`: Run this task to create a new user in the database. The user will be able to login to the web interface. This command can be run entirely in a non-interactive mode with the following parameters: `yarn create-user --username <username> --email <email> --password <clearTextPassword> [--first_name <firstName> --last_name <lastName> --[no-]admin --[no-]valid --[no-]confirmed --prefs <jsonStringOfPreferences>]`. For example, to create and administrator user with the english language as preference, run the following command `yarn create-user --username admin --email admin@example.org --password MyAdminPassword --admin --prefs '{ "lang": "en" }'`

## Getting started

**An example configuration and geographical area can be found in [the examples](examples/) directory.**

### Create a config file

Create a `config.js` file with the project's configuration. See the [config file in the examples directory](examples/config.js) for an example configuration.

The main options to configure are the `mapDefaultCenter` which is usually around the center of the area that will be served by the instance of Transition and the `projectDirectory`, which is the local path where runtime files, user data, local osrm files, log files, etc. will be stored.

The example config file contains preferences to run the `osrm` servers for each mode locally. They are started when Transition starts. To use external osrm server, the configuration can be updated as follows, for example for the walking mode:

```
[...]
walking: {
    port: 5001,
    host: https://external.osrm-server,
    autoStart: false,
    enabled: true
[...]
```

### Download and prepare the road network

Route calculations for transit route, walking access or egress to transit stops, etc. require a routing engine (`osrm`), which itself requires the road network from OpenStreetMap. The following commands will download and prepare the road network data for use with osrm. 

But first, a GeoJSON polygon file is required to specify the area for which to download and process the road network. To easily create a polygon, [geojson.io](https://geojson.io) can be used, which can then be copy-pasted to a file.

```shell
yarn node --max-old-space-size=4096 packages/chaire-lib-backend/lib/scripts/osrm/downloadOsmNetworkData.task.js --polygon-file examples/polygon_rtl_area.geojson

yarn node --max-old-space-size=4096 packages/chaire-lib-backend/lib/scripts/osrm/prepareOsmNetworkData.task.js
```

### Prepare the environment file

Transition relies on a few environment variables, that can either be set on the system, or contained in a .env file. First, copy the example .env file and edit the variables.

```
cp .env.example .env
```

* Change `PG_CONNECTION_STRING_PREFIX=postgres://postgres:@localhost:5432/` to `PG_CONNECTION_STRING_PREFIX=postgres://postgres:YOUR_POSTGRES_PASSWORD@localhost:5432/`
* Change `EXPRESS_SESSION_SECRET_KEY` to a random string with no space.
* Change `PROJECT_CONFIG` to point to your project's configuration file. The default is an example configuration file that can be copied and configured for your own need.

### Create the client application

Run `yarn build:dev` or `yarn build:prod` to create the html client application that will be run on the browser. 

The `prod` version is minified, while the `dev` version has greater size but allows to more easily debug the application.

*Note: If running with node version 18, webpack may return an error. In that case, run `export NODE_OPTIONS=--openssl-legacy-provider` before.*

### Start the json2capnp cache server

*Optional*

Run `yarn start:json2capnp -- 2000 /absolute/path/to/cache/directory/` to start the rust server to run the json2capnp cache service. 

This is required if the `defaultPreferences:json2capnp:enabled` preference is set to `true` in the `config.js` file (`true` is the default, to not use the rust server, set the value to `false` under the default preferences).

### Start the Node.js server

Use one of these alternative start command:

* `yarn start`: Start the server, with normal operation
* `yarn start:debug`: Start the server with extra debugging information
* `yarn start:tracing` Start the Node.js server with an OpenTelemetry config defined in a `tracing.js` file (placed in the root directory). See https://github.com/open-telemetry/opentelemetry-js/blob/main/getting-started/README.md#initialize-a-global-tracer for an example. 

### Open the application

Open your browser and navigate to `http://localhost:8080` to access the Transition login page.


## Using Docker
You can easily launch the whole transition system using Docker and thus not having to install all the dependencies directly.

### Building the image
`docker build -t testtransition .`
(You can replace testtransition with your prefered image name. Don't forget to update any other command and compose file if you do so)
To run the application directly, you'll need to add a `.env` as previously described, either by editing the `.env.docker` file before building the image, or by adding a `.env` file and pointing to it when running.

**Warning**: The project directory is assumed to be in `/app/examples/runtime` with a project name of `demo_transition`. The cache server starts with a cache at this location. If it is not the case, update line 68 of the `Dockerfile` to fine-tune the cache directory as second argument to `json2capnp`.

### Running using docker-compose
An example docker-compose.yml file is available in the repository. If used, it will spin up a container for the transition 
front-end and for dependent services like the postgis database.

*The `docker-compose.yml` file contains customisation suggestions.*

* `docker-compose up -d`

On the first run, you'll need to run the the DB setup commands. See the Installation section of this document for the full details. As a short-hand:
* `docker exec transition_transition-www_1 yarn setup`
* `docker exec transition_transition-www_1 yarn migrate`
* `docker exec -it transition_transition-www_1 yarn create-user`
* `docker-compose restart`

To load OSRM Data:
Copy a GeoJSON polygon.

#TODO Maybe the whole projects directory should be in a volume
```shell
docker cp /path/to/my/random_polygon.geojson transition_transition-www_1:/app/examples/runtime/imports/polygon.geojson

docker exec -it transition_transition-www_1 yarn node --max-old-space-size=4096 /app/packages/chaire-lib-backend/lib/scripts/osrm/downloadOsmNetworkData.task.js --polygon-file /app/examples/runtime/imports/polygon.geojson

docker exec -it transition_transition-www_1 yarn node --max-old-space-size=4096 /app/packages/chaire-lib-backend/lib/scripts/osrm/prepareOsmNetworkData.task.js
```

### Running development commands
During development, you can run commands in the docker image and use your local code.
For example, to run yarn test in the chaire-lib backend:
`docker run -a STDOUT -it -v "${PWD}:/home/project" -w=/home/project/transition-app/chaire-lib/backend/ testtransition yarn test`
You can also run the app this way with:
`docker run -a STDOUT -it -v "${PWD}:/home/project" -w=/home/project/ testtransition yarn start`

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md)

## License
[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fchairemobilite%2Ftransition.svg?type=large)](https://app.fossa.com/projects/git%2Bgithub.com%2Fchairemobilite%2Ftransition?ref=badge_large)