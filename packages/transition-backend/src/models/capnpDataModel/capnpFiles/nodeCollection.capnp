@0xa099e4ab58cfbe39;

using Cxx = import "/capnp/c++.capnp";
$Cxx.namespace("nodeCollection");

struct Node {
  uuid                    @0  :Text;
  id                      @1  :UInt32; # unique for the whole network (integer_id in database)
  internalId              @2  :Text;
  code                    @3  :Text;
  name                    @4  :Text;
  latitude                @5  :Int32; # divide by 1000000 to get float
  longitude               @6  :Int32; # divide by 1000000 to get float
  stationUuid             @7  :Text;
  color                   @8  :Text;
  description             @9  :Text;
  data                    @10 :Text;
  isEnabled               @11 :Int8;
  routingRadiusMeters     @12 :Int16;
  defaultDwellTimeSeconds @13 :Int16;
  isFrozen                @14 :Int8;
}

struct NodeCollection {
  nodes @0 :List(Node);
}
