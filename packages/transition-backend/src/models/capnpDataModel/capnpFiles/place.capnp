@0xd46f5ecd107c0374;

using Cxx = import "/capnp/c++.capnp";
$Cxx.namespace("place");

struct Place {
  
  uuid             @0  :Text;
  dataSourceUuid   @1  :Text;
  id               @2  :UInt32;
  shortname        @3  :Text;
  name             @4  :Text;
  description      @5  :Text;
  latitude         @6  :Int32; # divide by 1000000 to get float
  longitude        @7  :Int32; # divide by 1000000 to get float
  nodesUuids       @8  :List(Text);
  nodesTravelTimes @9  :List(Int16); # seconds
  nodesDistances   @10 :List(Int16); # meters
  internalId       @11 :Text;
  data             @12 :Text; # json
  isFrozen         @13 :Int8;

}