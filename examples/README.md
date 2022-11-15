This folder contains an example configuration file, as well as necessary files to run a demo of Transition. This demo corresponds to the territory of the [Réseau de transport de Longueuil](https://www.rtl-longueuil.qc.ca/) area.

# Running the demo

1. Make sure all the pre-requisites are installed. For complete installation instructions of all dependencies, see the [instructions for Ubuntu](../../docs/transition/setupDevEnvironmentUbuntu20.04.md).

2. Update the .env file and set the `PROJECT_CONFIG` to point to the config file in this directory

```
PROJECT_CONFIG=${rootDir}/examples/transition/config.js
```

3. Follow the [installations instructions](../../README.md#installation) at the root of this repo to setup the database and create users

4. Follow the [build and start instructions](../../README.md#build-and-start) at the root of this repo to compile and build the code, but do not start the nodejs server yet.

5. Get and prepare the road network for `osrm` to route. This step is optional, but required to create new lines that properly follow the road network. The first line will download the Open Street Map network data from the overpass API. The second line will prepare the data for the `osrm` servers. Data is prepared differently for different modes of tranportation. Selecting `driving` and `walking` are mandatory modes, as `driving` is the default mode for vehicles and `walking` is required to calculate access, transfer and egress times from transit.

```shell
yarn babel-node --max-old-space-size=4096 packages/chaire-lib-backend/lib/scripts/osrm/downloadOsmNetworkData.task.js --polygon-file examples/transition/polygon_rtl_area.geojson

yarn babel-node --max-old-space-size=4096 packages/chaire-lib-backend/lib/scripts/osrm/prepareOsmNetworkData.task.js
```

6. Start the nodejs server with `yarn start`.

7. Navigate to `http://localhost:8080` and log into the application.

8. Import [transit data for the Réseau de Transport de Longueuil](https://transitfeeds.com/p/reseau-de-transport-de-longueuil/37), that will work for the area of this demo. Lines and paths can be edited, added within this territory.

# Running the application for another territory

Copy or edit the config.js file and update for the area. The `projectDirectory` (where the road network will be stored) and `mapDefaultCenter` are the main fields to update. Be sure to point the `PROJECT_CONFIG` environment variable to this new file.

Download and prepare the road network data for another area. Simply save a geojson polygon feature to a file, similar to the [polygon_rtl_area.geojson](polygon_rtl_area.geojson) file. To easily create a polygon, [geojson.io](https://geojson.io) can be used.

