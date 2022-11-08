# Transition
[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fchairemobilite%2Ftransition.svg?type=shield)](https://app.fossa.com/projects/git%2Bgithub.com%2Fchairemobilite%2Ftransition?ref=badge_shield)

Transition is a modern new approach to transit planning. This repo is a Node/React web application to model, simulate and plan public transit and alternative transportation.

See http://transition.city/


[Definitions and symbols used in the code and in the interface](https://www.overleaf.com/read/dtxfhttxgjrx)

For Ubuntu users: [complete step-by-step development environment setup procedure](docs/setupDevEnvironmentUbuntu20.04.md)

## Non-Node Dependencies

* PostgreSQL 10+ with PostGIS
* [OSRM](https://github.com/Project-OSRM/osrm-backend/)
* [trRouting](https://github.com/chairemobilite/trRouting/)
* yarn: [debian/ubuntu](https://classic.yarnpkg.com/en/docs/install/#debian-stable) [macos](https://classic.yarnpkg.com/en/docs/install/#mac-stable)
* Rust (it is used to run the json2capnp cache service which makes the application much faster if there's a lot of transit data)

## Installation

* Install Node and Yarn
* Create a `.env` file in the project root directory (you can copy the `.env.example` file) and setup the project
* `yarn install` or just `yarn`: Will download the packages required by the application
* `yarn setup`: Run this command to setup the database for the current project
* `yarn migrate`: Update the database schema with latest changes. This can be run whenever the source code is updated
* Optionally `yarn create-user`: Run this task to create a new user in the database. The user will be able to login to the web interface. This command can be run entirely in a non-interactive mode with the following parameters: `yarn create-user --username <username> --email <email> --password <clearTextPassword> [--first_name <firstName> --last_name <lastName> --[no-]admin --[no-]valid --[no-]confirmed --prefs <jsonStringOfPreferences>]`. For example, to create and administrator user with the english language as preference, run the following command `yarn create-user --username admin --email admin@example.org --password MyAdminPassword --admin --prefs '{ "lang": "en" }'`


### For testing:
* `yarn setup-test`: Same as `yarn setup`, but for the TEST environment. It should be run before running the database tests.
* `yarn migrate-test`: Same as `yarn migrate`, but for the TEST environment. It should be run before running the database tests.

## Build and start

**An example configuration and geographical area can be found in [the examples](examples/) directory.**

* `yarn compile`: Convert the typescript files to javascript
* Download and prepare the road network: Route calculations for transit route, walking access or egress to transit stops, etc require a routing engine (`osrm`), which itself requires the road network from Open Street map. The following commands will download and prepare the road network data for use with osrm. You first need a geojson polygon file to define the area for which to get the data.

```shell
yarn babel-node --max-old-space-size=4096 transition-app/chaire-lib/backend/lib/scripts/osrm/downloadOsmNetworkData.task.js --polygon-file path/to/polygon_area.geojson

yarn babel-node --max-old-space-size=4096 transition-app/chaire-lib/backend/lib/scripts/osrm/prepareOsmNetworkData.task.js
```

* Optionally `yarn compile:dev` (keep running in the background to watch changes in the typescript code in all workspaces)
* `yarn build:dev` or `yarn build:prod` (keep running in the background if you want to watch changes in the code): Create the html application that will be run on the browser
* Optionally `yarn start:json2capnp -- 2000 /absolute/path/to/cache/directory/` to start the rust server to run the json2capnp cache service. This is required if the `defaultPreferences:json2capnp:enabled` preference is set to `true` in the `config.js` file (`true` is the default, to not use the rust server, set the value to `false` under the default preferences).
* Start the nodejs server with one of these alternative in a new shell:
  * `yarn start`: Normal operation
  * `yarn start:debug`: Debug mode
  * `yarn start:tracing` Start the nodejs server with an OpenTelemetry config defined in a `tracing.js` file (placed in the root directory). See https://github.com/open-telemetry/opentelemetry-js/blob/main/getting-started/README.md#initialize-a-global-tracer for an example. 


## Using Docker
You can easily launch the whole transition system using Docker and thus not having to install all the dependencies directly.

### Building the image
`docker build -t testtransition .`
(You can replace testtransition with your prefered image name. Don't forget to update any other command and compose file if you do so)
To run the application directly, you'll need to add an .env as previously described before building. 

### Running using docker-compose
An example docker-compose.yml file is available in the reposity. If used, it will spin up a container for the transition
front-end and for dependent services like the postgis database
* `docker-compose up -d`
On the first run, you'll need to run the the DB setup commands. See the Installation section of this document for the full details. As a short-hand:
* `docker exec transition_transition-www_1 yarn setup`
* `docker exec transition_transition-www_1 yarn migrate`
* `docker exec -it transition_transition-www_1 yarn create-user`
* `docker-compose restart`

To load OSRM Data:
Copy a geojson polygon
#TODO Maybe the whole projects directory should be in a volume
docker cp /path/to/my/random_polygon.geojson transition_transition-www_1:/app/projects/demo_transition/imports/polygon.geojson
### TODO ADD  downloadosmtask....
docker exec -it transition_transition-www_1 yarn babel-node --max-old-space-size=4096 /app/src/tasks/transition/osrm/prepareOsmNetworkData.task.js

### Running development commands
During development, you can run command in the docker image and use your local code.
For example to run yarn test in the chaire-lib backend:
`docker run -a STDOUT -it -v "${PWD}:/home/project" -w=/home/project/transition-app/chaire-lib/backend/ testtransition yarn test`
You can also run the app this way with:
`docker run -a STDOUT -it -v "${PWD}:/home/project" -w=/home/project/ testtransition yarn start`

## Contributing

### Coding guidelines

To ensure consistency throughout the code base, we use `prettier` and `eslint` to automatically format the code files. Since code formatting in javascript/typescript is opinionated, the coding rules are described in the configs/ directory. The base rules are taken from the [google GTS project](https://github.com/google/gts) and some were added.

To automatically format code files in a workspace, simply run `yarn format` before a commit.

Unfamiliar with the review process? Read [The ABC of a Pull Request](docs/ABC_of_pull_requests.md).

### Debugging

The `.vscode/launch.json.example` file contains various vscode launch configuration that can be used to debug the server, the browsers or units tests. You can copy it in a `.vscode/launch.json` file and edit them for each developer's need and specific configuration.

### Inspecting the frontend bundle

Once in a while, developers should examine the size and content of the frontend bundle, to see if any low-hanging fruit optimization is possible. One possible way to do so is with the `webpack-bundle-analyzer` plugin. One can locally add the plugin as a dev dependency in the workspace doing the webpack `yarn add --dev webpack-bundle-analyzer`. And in the webpack.config.js file, add the following code:

```
[...]
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
[...]
return {
    [...]
    plugins: {
        new BundleAnalyzerPlugin(),
        [...]
    }
}
```

## License
[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fchairemobilite%2Ftransition.svg?type=large)](https://app.fossa.com/projects/git%2Bgithub.com%2Fchairemobilite%2Ftransition?ref=badge_large)