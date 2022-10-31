@0xf4952682718a13e5;

using Cxx = import "/capnp/c++.capnp";
$Cxx.namespace("pathCollection");

struct Path {
  uuid        @0  :Text;
  id          @1  :Int32;
  internalId  @2  :Text;
  direction   @3  :Text;
  lineUuid    @4  :Text;
  name        @5  :Text;
  isEnabled   @6  :Int8;
  description @7  :Text;
  data        @8  :Text;
  nodesUuids  @9  :List(Text);
  stopsUuids  @10 :List(Text);
  segments    @11 :List(Int32); # index of the first coordinate of segment in geography coordinates
  geography   @12 :Data; # geojson geometry //geobuf precision 6 and 2 dimensions
  isFrozen    @13 :Int8;
}

struct PathCollection {
  paths @0 :List(Path);
}
