@0x98989522a3c141fc;

using Cxx = import "/capnp/c++.capnp";
$Cxx.namespace("zoneCollection");

using Zone = import "zone.capnp".Zone;

struct ZoneCollection {
  zones @0 :List(Zone);
}

