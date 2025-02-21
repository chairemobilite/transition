# Transition Docker installation for development

This tutorial is intended towards developers who want to setup Transition inside a Docker container. Any code modification will be applied instantly to the container, so you don't need to rebuild the image each time. 

### 1. Install Docker for desktop if needed

Follow [the docker for desktop](https://www.docker.com/products/docker-desktop/) for instructions to install the docker for desktop application locally.

If you are already familiar with docker and can run container and scripts easily, you don't have to install docker for desktop.

### 2. Get a mapbox access token

* Go to [Mapbox](http://mapbox.com) and sign up
* Go to your account dashboard, then generate a new access token

Keep this access token for the next step.


### 3. Add your mapbox token to the .env.docker file

The `.env.docker` file is required to contain some environment variables that are not yet available through the configuration. The file has already been created for you, you simply need to finish the configuration. [It's located at the root of the `transition` repo](../.env.docker).

In order for the map to be displayed correctly, simply modify the field `MAPBOX_ACCESS_TOKEN` with the key you've acquired in the previous section. You must not push your key to the remote repo.
```
MAPBOX_ACCESS_TOKEN=<paste_your_key_here>
```
> Note: You can modify other fields in this file if needed. This is only the base configuration needed to run the app.


### 4. Add your custom polygon for your region

In order to have routing data to calculate the routes, the data must be fetched from OpenStreetMap for a given polygon. If you have a geojson file containing the geojson polygon to fetch, add this file to the `transition` directory. There is [an example file](../examples/polygon_rtl_area.geojson) in this repo.

It is not required, but if not set, routing won't be able to follow the road network.

If you don't have a `.geojson` polygon, use the [example file](../examples/polygon_rtl_area.geojson).

### 5. Run for the first time

Some initialization scripts need to be executed on the very first run of Transition, to set up the database and download the road network. 

First, launch Transition by opening a Terminal in the `transition/` root folder, and by using the command 
```
docker compose -f docker-compose.yml -f docker-dev/docker-compose.override.yml up -d --build
```
This will first build the app's image (that usually takes a few minutes). Once the command exits, the app has been launched.

Now, with the same terminal you've just opened, run this command to copy your GeoJSON file to the runtime of the app. 
> Note: If you're using another GeoJSON file than the one provided as an example (`examples/polygon_rtl_area.geojson`), you need to modify the path specified in the first argument of the command

```
docker cp ./examples/polygon_rtl_area.geojson docker-dev-transition-www-1:/app/examples/runtime/imports/polygon.geojson
```

Then, in  Docker Desktop, select **Containers** on the left, then click on `docker-dev-transition-www-1` and go to the `Terminal` tab. Run the following commands.

> Note: You can also use `docker exec -it docker-dev-transition-www-1` to run these commands without Docker Desktop

```
yarn setup && yarn migrate
```
```
yarn node --max-old-space-size=4096 /app/packages/chaire-lib-backend/lib/scripts/osrm/downloadOsmNetworkData.task.js --polygon-file /app/examples/runtime/imports/polygon.geojson
```
For the following command, you will need to choose the transportation types you'd like to import. You should ideally at least select `walking`, `driving` and `bus_urban`, but it's not essential for running the app.
```
yarn node --max-old-space-size=4096 /app/packages/chaire-lib-backend/lib/scripts/osrm/prepareOsmNetworkData.task.js
```
    
Finally, in the same terminal, create your transition user. Run this command and follow the instructions.
```
yarn create-user 
```

The setup is now complete. To finish the configuration, you need to restart the app. You can either use the stop/play buttons in Docker Desktop, or run `docker compose -f docker-compose.yml docker-dev/docker-compose.override.yml restart` in your terminal.

### 5.1 Run the application

Once the app is setup, you only need to run `docker compose -f docker-compose.yml -f docker-dev/docker-compose.override.yml up` to launch it. If you make code changes, the app should rebuild itself automatically.
 