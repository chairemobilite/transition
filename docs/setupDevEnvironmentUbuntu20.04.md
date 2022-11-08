# Setup development environment on Ubuntu

*Tested on Ubuntu 20.04 LTS (Focal Fossa)*

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
sudo -u postgres psql
```
* Choose a password: `\password`
* Quit psql: `\q`

## Install OSRM

* Build and install: checkout a specific version tag. Latest tested version is v5.26.0.
```
cd ~/sources/osrm-backend
git checkout tags/v5.26.0
git switch -c 5.26.0
mkdir -p build
cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
cmake --build .
sudo cmake --build . --target install
```

## Install trRouting
```
cd ~/sources/trRouting
autoreconf -i
./configure
make
sudo make install
```

## Install and setup node and yarn
```
curl -sL https://deb.nodesource.com/setup_13.x | sudo bash -
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
```
### Configure the .env file
* Change `PG_CONNECTION_STRING_PREFIX=postgres://postgres:@localhost:5432/` to `PG_CONNECTION_STRING_PREFIX=postgres://postgres:YOUR_POSTGRES_PASSWORD@localhost:5432/`
* Change `EXPRESS_SESSION_SECRET_KEY` to a random string with no space
* Change `PROJECT_CONFIG` to point to your project's configuration file. The default is an example configuration file that can be copied and configured for your own need.

### Get a Mapbox access token
* Go to [Mapbox](http://mapxbox.com) and sign up
* Go to your account dashboard, then generate a new access token
* Open the `.env` file
* Copy this access token to `.env` file: `MAPBOX_ACCESS_TOKEN=YOUR_TOKEN`
* If you have a custom mapbox style, put your username and style id in `MAPBOX_USER_ID` and `MAPBOX_STYLE_ID`


### Setup project
```
yarn setup
yarn migrate
yarn compile
yarn create-user
```

* In a new shell: `yarn start`
* In a new shell: `yarn compile:dev` or `yarn compile`
* In a new shell: `yarn build:dev` or `yarn build:prod`
* In a new shell: `yarn start:json2capnp -- 2000 /absolute/path/to/cache/file`
