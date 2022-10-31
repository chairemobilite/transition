@0xc432eb24a9ca5905;

using Cxx = import "/capnp/c++.capnp";
$Cxx.namespace("placeCollection");

using Place = import "place.capnp".Place;

struct PlaceCollection {
  places @0 :List(Place);
}

