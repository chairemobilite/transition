# Setup development environment on Ubuntu

*Tested on Ubuntu 24.04*

These instructions will setup a complete development environment for Transition on a new installation of Ubuntu (like a virtual machine). Some of these instructions are not necessary to simply run the application.

## Update ubuntu

```bash
sudo apt-get update
sudo apt-get upgrade
sudo apt-get dist-upgrade
```

## Install dependencies

```bash
sudo apt-get install git ssh curl wget gcc g++ cmake \
libstxxl-dev libxml2-dev libsparsehash-dev libbz2-dev zlib1g-dev libzip-dev libgomp1 \
pkg-config libgdal-dev libtbb-dev psmisc build-essential postgresql postgis \
clang libboost-all-dev libexpat1-dev libjsoncpp-dev libncurses5-dev lua5.3 liblua5.3-dev \
powerline fonts-powerline zsh capnproto libcapnp-dev postgresql-postgis \
postgresql-postgis-scripts rustc cargo rustfmt rust-clippy
```

## Create sources directory

```bash
cd ~
mkdir sources
```

## Generate ssh key

*Optional, only for contributing remote patches*

```bash
ssh-keygen -t rsa -b 4096 -C "YOUR_EMAIL"
```

* Press Enter to use the default
* Press Enter again twice to use no passphrase

```bash
eval "$(ssh-agent -s)"
```

* Make sure you get "Agent pid [SOME_NUMBER]"

Add your SSH key to the agent:

```bash
# On Linux:
ssh-add ~/.ssh/id_rsa

# On macOS:
ssh-add --apple-load-keychain ~/.ssh/id_rsa
```

View your public key to copy to GitHub:

```bash
nano ~/.ssh/id_rsa.pub
```

* Copy this key to GitHub (In GitHub: User icon->Settings->SSH and GPG keys->New SSH key)

## Clone repos

```bash
cd ~/sources
git clone ssh://git@github.com/Project-OSRM/osrm-backend
git clone ssh://git@github.com/chairemobilite/trRouting
git clone ssh://git@github.com/chairemobilite/transition
```

## Setup Postgresql

```bash
sudo service postgresql start
sudo -u postgres psql
```

* Choose a password: `\password`
* Quit psql: `\q`

## Install OSRM

```bash
cd ~/sources/osrm-backend
git log
git checkout main
```

```bash
mkdir -p build
cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
cmake --build .
sudo cmake --build . --target install
```

**Resolving the "Intel TBB NOT found" Compilation Error**
If you encounter the *Intel TBB NOT found (CMake Error at cmake/FindTBB.cmake)* error during compilation, you can refer to Issue #6704 in the [Project-OSRM/osrm-backend repository](https://github.com/Project-OSRM/osrm-backend/issues/6704). This issue explains a workaround for the problem.

## Install trRouting

```bash
sudo apt-get install clang libboost-all-dev libexpat1-dev libjsoncpp-dev libspdlog-dev nlohmann-json3-dev
```

```bash
cd ~/sources/trRouting
autoreconf -i
./configure
make
sudo make install
```

## Install Node.js and Yarn

Transition needs Node.js 24 or later. The `nodejs` package from the Ubuntu archive is too old (18 on Ubuntu 24.04, 22 on Ubuntu 26.04), so install Node.js with one of the two options below. Use only one: with two installations, which `node` runs depends on the `PATH`.

Yarn itself is not installed: [Corepack](https://yarnpkg.com/corepack), installed last in both options, provides the `yarn` command and runs the Yarn version set in the `packageManager` field of `package.json`. If Yarn 1 was previously installed from the Yarn apt repository, remove it first with `sudo apt-get remove yarn` and delete `/etc/apt/sources.list.d/yarn.list`.

### Option 1: NodeSource apt repository

[NodeSource](https://github.com/nodesource/distributions) packages Node.js for Ubuntu, so it is updated with the rest of the system by `apt`. Instead of piping NodeSource's setup script to `sudo bash`, add the repository directly, as in [NodeSource's manual installation guide](https://github.com/nodesource/distributions/wiki/Repository-Manual-Installation). The `Signed-By` field restricts NodeSource's key to this one repository.

```bash
sudo apt-get install -y ca-certificates curl gnupg
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | sudo gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
sudo tee /etc/apt/sources.list.d/nodesource.sources > /dev/null <<'EOF'
Types: deb
URIs: https://deb.nodesource.com/node_24.x
Suites: nodistro
Components: main
Signed-By: /etc/apt/keyrings/nodesource.gpg
EOF
sudo apt-get update
sudo apt-get install -y nodejs
sudo npm install -g corepack
```

To move to another Node.js major version later, change `node_24.x` in `/etc/apt/sources.list.d/nodesource.sources`, then run `sudo apt-get update && sudo apt-get upgrade`.

If NodeSource's setup script was run on this machine before, delete the `/etc/apt/sources.list.d/nodesource.list` file it may have left: apt refuses two entries for the same repository signed by different key files.

### Option 2: nvm

[nvm](https://github.com/nvm-sh/nvm) installs Node.js in your home directory and switches versions per shell, which helps when other projects need another Node.js version. Install nvm by following the [instructions in its README](https://github.com/nvm-sh/nvm#installing-and-updating), open a new terminal, then run:

```bash
nvm install 24
npm install -g corepack
```

No `sudo` is needed with nvm. Global packages such as Corepack belong to one Node.js version, so after installing another version, either install Corepack again or install that version with `nvm install <version> --reinstall-packages-from=24`.

Other version managers, such as [fnm](https://github.com/Schniz/fnm) or [mise](https://mise.jdx.dev/), work too: install Node.js 24 with them, then run `npm install -g corepack`.

## Install Transition

```bash
cd ~/sources/transition
yarn install
cp .env.example .env
cp examples/config.js config.js
mkdir runtime
```

### Configure the .env file in the Transition directory

* Change `PG_CONNECTION_STRING_PREFIX=postgres://postgres:@localhost:5432/` to `PG_CONNECTION_STRING_PREFIX=postgres://postgres:YOUR_POSTGRES_PASSWORD@localhost:5432/`
* Change `EXPRESS_SESSION_SECRET_KEY` to a random string with no space
* Change `PROJECT_CONFIG` to point to your project's configuration file. The default is an example configuration file that can be copied and configured for your own need.

The default map uses OpenStreetMap tiles which don't require any API keys. If you want to add custom raster tiles (such as aerial imagery), you can optionally configure:
* `CUSTOM_RASTER_TILES_XYZ_URL=https://your-tile-server/{z}/{x}/{y}` - URL template for your custom tile server
* `CUSTOM_RASTER_TILES_MIN_ZOOM=10` - Minimum zoom level at which custom tiles are available (default: 0)
* `CUSTOM_RASTER_TILES_MAX_ZOOM=18` - Maximum zoom level at which custom tiles are available (default: 22)

Users can switch between OSM and custom tiles using the layer switcher button in the application. The custom tiles option will only be enabled when the current zoom level is within the configured min/max range.

### Setup project

```bash
yarn compile
yarn setup
yarn migrate
yarn create-user
```

When creating a user, you may provide an email address as a backup in case of a login failure.

### Download and prepare the road network

```bash
yarn node --max-old-space-size=4096 packages/chaire-lib-backend/lib/scripts/osrm/downloadOsmNetworkData.task.js --polygon-file examples/polygon_rtl_area.geojson

yarn node --max-old-space-size=4096 packages/chaire-lib-backend/lib/scripts/osrm/prepareOsmNetworkData.task.js
```

For the transport mode, choose walk, driving, bus-urban.

* In a new shell: `yarn compile:dev` or `yarn compile`
* In a new shell: `yarn build:dev` or `yarn build:prod`
* In a new shell: `yarn start`
