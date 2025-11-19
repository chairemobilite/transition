# Install complete Transition with Docker

This installation documentation is targeted in end-users who want to try Transition locally, who do not have access to an infrastructure for web server deployment. It runs the server and its dependencies using `docker`.

### 1. Install Docker for desktop

Follow [the docker for desktop](https://www.docker.com/products/docker-desktop/) for instructions to install the docker for desktop application locally.

If you are already familiar with docker and can run container and scripts easily, you don't have to install docker for desktop.

### 2. Prepare the docker compose file

There is a few files to prepare in order to run Transition. It is suggested to create a new empty directory where to put all those file, with the following structure:

```
<base Transition dir>
|-- docker-compose.yml
|-- transition
|-- |-- .env
|-- |-- config.js
|-- |-- polygon.geojson
```

The first file is called `docker-compose.yml` and contains the definition of the docker images to run. Copy the following code to your local `docker-compose.yml` file.

```{yml}

services:
  transition-www:
    image: chairemobilite/transition
    ports:
      - 8080:8080
    environment:
      PG_CONNECTION_STRING_PREFIX: postgres://postgres:pass@postgres:5432/
      # CUSTOM Add environment variables. This can be any variable contained in the .env file. These have precedence over their value in .env
      PROJECT_CONFIG: /config/config.js
      TRANSITION_DOTENV: /config/.env
    command:
      - "/bin/sh"
      - "-c"
      - "sh -c \"cd services/json2capnp && pwd && ./json2capnp 2000 /config/runtime/cache/demo_transition > /config/runtime/json2capnp.log & yarn build:prod && yarn start\""
    depends_on:
      - postgres
    tty: true
    volumes:
      - "./transition:/config"

  postgres:
    image: postgis/postgis
    volumes:
      - transition-postgis-data:/var/lib/postgresql/data
    environment:
      POSTGRES_PASSWORD: pass

volumes:
  transition-postgis-data:
```

### 3. Prepare the config.js file

Now create a directory named `transition` in the directory containing the `docker-compose.yml` file. This exact directory name is required as it is configured in the docker compose file.

Create a file called `config.js` in the `transition` directory with the following data. You can fine-tune it to fit your need, but it would work as is.

```{js}
module.exports = {

    projectShortname: 'demo_transition',
    projectDirectory: `${__dirname}/runtime/`,
    auth: {
      localLogin: {
        allowRegistration: true,
        // This will send an email to confirm the user's email address. Email send needs to be configured. By default, users can register and directly login.
        // confirmEmail: true
      }
    },
  
    mapDefaultCenter: {
      lat: 45.5092960,
      lon: -73.4769080
    },
  
    languages: ['fr', 'en'],
  
    locales: {
      fr: 'fr-CA',
      en: 'en-CA'
    },
    
    languageNames: {
      fr: "Français",
      en: "English"
    },
  
    title: {
      fr: "Démo",
      en: "Demo"
    },
    
    defaultLocale: "fr",
    timezone: "America/Montreal",
    gtfs: {
      socketFileUploaderOptions: {
        uploadDirectory                : 'gtfs',
        fileExtension                  : 'zip',
        renamedFileNameWithoutExtension: 'import',
        acceptTypes                    : ['application/zip'],
        maxFileSizeMB                  : 256,
        chunckSizeMB                   : 10240000,
        overwriteExistingFile          : true
      }
    }
  
};
```

### 4. Prepare the .env file

The .env file is required to contain some environment variables that are not yet available through the configuration.

Create a `.env` file in the `transition` directory. The default map uses OpenStreetMap tiles which don't require any API keys.

```
HOST=http://localhost:8080
PG_DATABASE_DEVELOPMENT=tr_dev
PG_DATABASE_PRODUCTION=tr
PG_DATABASE_TEST=tr_test
PG_CONNECTION_STRING_PREFIX=postgres://postgres:@localhost:5432/
EXPRESS_SESSION_SECRET_KEY=DefaultDockerSessionKey

# Optional: Custom raster tiles for aerial imagery or other base maps
# If configured, users can switch between OSM and custom tiles using the layer switcher
#CUSTOM_RASTER_TILES_XYZ_URL=https://exampltest/{z}/{x}/{y}
#CUSTOM_RASTER_TILES_MIN_ZOOM=8
#CUSTOM_RASTER_TILES_MAX_ZOOM=22
#SSL_PRIVATE_KEY=/path/to/privkey.pem
#SSL_CERT=/path/to/sslcert.pem
STARTUP_RECREATE_CACHE=false


##############################################################
# Mailing configuration, required for sending emails to users
# strategy can be 'smtp' or 'sendmail'
MAIL_TRANSPORT_STRATEGY=smtp

# Sendmail strategy requires a path to sendmail
# MAIL_TRANSPORT_SENDMAIL_PATH=/usr/sbin/sendmail

# smtp requires credentials to the smtp server and additional configurations
MAIL_TRANSPORT_SMTP_HOST=smtp.example.org
MAIL_TRANSPORT_SMTP_PORT=587
# Whether to use TLS 
MAIL_TRANSPORT_SMTP_SECURE=false
# SMTP server credentials
MAIL_TRANSPORT_SMTP_AUTH_USER=myUser
MAIL_TRANSPORT_SMTP_AUTH_PWD=password

# From email
MAIL_FROM_ADDRESS=example@example.com

```

### 5. Prepare the polygon for your region

In order to have routing data to calculate the routes, the data must be fetched from OpenStreetMap for a given polygon. If you have a geojson file containing the geojson polygon to fetch, add this file to the `transition` directory. There is [an example file](../examples/polygon_rtl_area.geojson) in this repo.

It is not required, but if not set, routing won't be able to follow the road network.

### 6. Run the application

Using a terminal, navigate to the directory where the `docker-compose.yml` and the `transition` directory are located. Then run `docker-compose up`.

In the Docker for desktop application, you should see 2 new containers running, one for postgis, the other for Transition, as shown in the following screenshot

![2 running containers in docker for desktop](images/docker/dockerDesktopContainersRunning.png)

The application should now be available from a browser at `http://localhost:8080`

### 6.1 Run for the first time

Some initialization scripts need to be run on the very first run of Transition, to set up the database and download the road network. In the Docker Desktop containers list, select the one prefixed with `testtransitiondocker_transition-www` and go to the `Terminal` tab. Run the following commands:

```
$ yarn setup && yarn migrate

$ yarn node --max-old-space-size=4096 packages/chaire-lib-backend/lib/scripts/osrm/downloadOsmNetworkData.task.js --polygon-file /config/<name of your polygon file>.geojson

$ yarn node --max-old-space-size=4096 packages/chaire-lib-backend/lib/scripts/osrm/prepareOsmNetworkData.task.js
```

![Docker Desktop terminal](images/docker//dockerDesktopTerminal.png)

You will need to stop and restart the transition-www container to have the changes applied. Just click on the Stop button and start it again after.