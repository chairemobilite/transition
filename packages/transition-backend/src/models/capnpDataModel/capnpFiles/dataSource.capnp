@0xb37128c5c8390a64;

using Cxx = import "/capnp/c++.capnp";
$Cxx.namespace("dataSource");

struct DataSource {
  
  uuid                 @0 :Text;
  type                 @1 :Type;
  shortname            @2 :Text;
  name                 @3 :Text;
  description          @4 :Text;
  data                 @5 :Text; # json
  isFrozen             @6 :Int8;
  
  enum Type {
    none                    @0;
    other                   @1;
    gtfs                    @2; # see https://gtfs.org/ or https://developers.google.com/transit/gtfs/
    odTrips                 @3; # must include households, persons and trips data
    transitSmartCardData    @4;
    transitOperationalData  @5;
    taxiTransactions        @6;
    carSharingTransactions  @7;
    bikeSharingTransactions @8;
    gpsTraces               @9;
    streetSegmentSpeeds     @10; # must match openStreetMap nodes and way ids. this represents measured or interpolated speeds on specific street segments
    zones                   @11;
    osmData                 @12;
    places                  @13;
    unknown                 @14;
  }

}
