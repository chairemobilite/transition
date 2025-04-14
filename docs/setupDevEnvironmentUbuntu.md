# Setup development environment on Ubuntu

*Tested on Ubuntu 24.04*

These instructions will setup a complete development environment for Transition on a new installation of Ubuntu (like a virtual machine). Some of these instructions are not necessary to simply run the application.

## Update ubuntu
```
sudo apt-get update
sudo apt-get upgrade
sudo apt-get dist-upgrade
```

## Install dependencies
```
sudo apt-get install git ssh curl wget gcc g++ cmake \
libstxxl-dev libxml2-dev libsparsehash-dev libbz2-dev zlib1g-dev libzip-dev libgomp1 \
pkg-config libgdal-dev libtbb-dev psmisc build-essential postgresql postgis \
clang libboost-all-dev libexpat1-dev libjsoncpp-dev libncurses5-dev lua5.3 liblua5.3-dev \
powerline fonts-powerline zsh capnproto libcapnp-dev postgresql-postgis \
postgresql-postgis-scripts rustc cargo
```

## Prerequisites
* yarn
```
curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add -
echo "deb https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list 
sudo apt update && sudo apt install yarn
```

## Create sources directory
```
cd ~
mkdir sources
```

## Generate ssh key

*Optional, only for contributing remote patches*

```
ssh-keygen -t rsa -b 4096 -C "YOUR_EMAIL"
```
* Press Enter to use the default
* Press Enter again twice to use no passphrase

```
eval "$(ssh-agent -s)"
```

* Make sure you get "Agent pid [SOME_NUMBER]"
```
ssh-add -K ~/.ssh/id_rsa
nano ~/.ssh/id_rsa.pub
```
* Copy this key to github (In github: User icon->Settings->SSH and GPG keys->New SSH key)


## Clone repos
```
cd ~/sources
git clone ssh://git@github.com/Project-OSRM/osrm-backend
git clone ssh://git@github.com/chairemobilite/trRouting
git clone ssh://git@github.com/chairemobilite/transition
```

## Setup Postgresql

```
sudo service postgresql start
sudo -u postgres psql
```
* Choose a password: `\password`
* Quit psql: `\q`

## Install OSRM
```
cd ~/sources/osrm-backend
git log
git checkout main
```

```
mkdir -p build
cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
cmake --build .
sudo cmake --build . --target install
```

**Resolving the "Intel TBB NOT found" Compilation Error**  
If you encounter the *Intel TBB NOT found (CMake Error at cmake/FindTBB.cmake)* error during compilation, you can refer to Issue #6704 in the [Project-OSRM/osrm-backend repository](https://github.com/Project-OSRM/osrm-backend/issues/6704). This issue explains a workaround for the problem.

## Install trRouting
```
sudo apt-get install clang libboost-all-dev libexpat1-dev libjsoncpp-dev libspdlog-dev nlohmann-json3-dev
```
```
cd ~/sources/trRouting
autoreconf -i
./configure
make
sudo make install
```

## Install and setup node and yarn
```
curl -sL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt-get install -y nodejs
curl -sL https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add -
echo "deb https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list
sudo apt-get update && sudo apt-get install yarn
```

## Install Transition
```
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


### Setup project
```
yarn compile
yarn setup
yarn migrate
yarn create-user
```
When creating a user, you may provide an email address as a backup in case of a login failure.


### Download and prepare the road network
```
yarn node --max-old-space-size=4096 packages/chaire-lib-backend/lib/scripts/osrm/downloadOsmNetworkData.task.js --polygon-file examples/polygon_rtl_area.geojson

yarn node --max-old-space-size=4096 packages/chaire-lib-backend/lib/scripts/osrm/prepareOsmNetworkData.task.js
```
For the transport mode, choose walk, driving, bus-urban.


* In a new shell: `yarn compile:dev` or `yarn compile`
* In a new shell: `yarn build:dev` or `yarn build:prod`
* In a new shell: `yarn start:json2capnp -- 2000 /absolute/path/to/cache/demo_transition`
* In a new shell: `yarn start`
