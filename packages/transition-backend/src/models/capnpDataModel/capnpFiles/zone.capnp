@0xd6181097cef171c1;

using Cxx = import "/capnp/c++.capnp";
$Cxx.namespace("zone");

struct Zone {
  
  uuid              @0 :Text;
  id                @1 :Int32;
  dataSourceUuid    @2 :Text;
  shortname         @3 :Text;
  name              @4 :Text;
  color             @5 :Text;
  description       @6 :Text;
  geography         @7 :Data; # geojson geometry //geobuf precision 6 and 2 dimensions
  internalId        @8 :Text;
  data              @9 :Text; # json
  isFrozen          @10 :Int8;

}