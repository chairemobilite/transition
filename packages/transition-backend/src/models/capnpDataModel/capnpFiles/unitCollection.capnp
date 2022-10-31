@0x9f589c74b7072cc0;

using Cxx = import "/capnp/c++.capnp";
$Cxx.namespace("unitCollection");

struct Unit {
  uuid                         @0  :Text;
  internalId                   @1  :Text;
  agencyUuid                   @2  :Text;
  garageUuid                   @3  :Text;
  lineUuid                     @4  :Text;
  mode                         @5  :Text;
  manufacturer                 @6  :Text;
  model                        @7  :Text;
  capacitySeated               @8  :Int16;
  capacityStanding             @9  :Int16;
  numberOfVehicles             @10 :Int16;
  numberOfDoors                @11 :Int16;
  numberOfDoorChannels         @12 :Int16;
  licenseNumber                @13 :Text;
  serialNumber                 @14 :Text;
  lengthMm                     @15 :Float32;
  widthMm                      @16 :Float32;
  data                         @17 :Text; # json
  isEnabled                    @18 :Int8;
  isFrozen                     @19 :Int8;
  id                           @20 :Int32;
  color                        @21  :Text;
}

struct UnitCollection {
  units @0 :List(Unit);
}
