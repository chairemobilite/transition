@0xe4c1200b2bf55c52;

using Cxx = import "/capnp/c++.capnp";
$Cxx.namespace("garageCollection");

struct Garage {
  uuid                         @0  :Text;
  id                           @1  :Int32;
  internalId                   @2  :Text;
  agencyUuid                   @3  :Text;
  name                         @4  :Text;
  color                        @5  :Text;
  geography                    @6  :Data; # geojson geometry //geobuf precision 6 and 2 dimensions
  isEnabled                    @7  :Int8;
  description                  @8  :Text;
  data                         @9  :Text; # json
  isFrozen                     @10 :Int8;
}

struct GarageCollection {
  garages @0 :List(Garage);
}
