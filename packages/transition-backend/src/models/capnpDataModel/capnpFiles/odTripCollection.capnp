@0x8ffad6ff4ac3568a;

using Cxx = import "/capnp/c++.capnp";
$Cxx.namespace("odTripCollection");

using OdTrip = import "odTrip.capnp".OdTrip;

struct OdTripCollection {
  odTrips @0 :List(OdTrip);
}

