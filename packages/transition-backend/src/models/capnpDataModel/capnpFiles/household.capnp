@0xa6587c9eb014ab3e;

using Cxx = import "/capnp/c++.capnp";
$Cxx.namespace("household");

struct Household {
  
  uuid                 @0  :Text;
  dataSourceUuid       @1  :Text;
  id                   @2  :UInt32;
  expansionFactor      @3  :Float32;
  size                 @4  :Int8;
  carNumber            @5  :Int8;
  incomeLevel          @6  :Int32;
  incomeLevelGroup     @7  :IncomeLevelGroup;
  category             @8  :Category;
  homeLatitude         @9  :Int32; # divide by 1000000 to get float
  homeLongitude        @10 :Int32; # divide by 1000000 to get float
  homeNodesUuids        @11 :List(Text);
  homeNodesTravelTimes @12 :List(Int16); # seconds
  homeNodesDistances   @13 :List(Int16); # meters
  internalId           @14 :Text;
  data                 @15 :Text; # json
  isFrozen             @16 :Int8;

  enum IncomeLevelGroup {
    none     @0;
    veryLow  @1;
    low      @2;
    medium   @3;
    high     @4;
    veryHigh @5;
    unknown  @6;
  }

  enum Category {
    none               @0;
    singlePerson       @1;
    couple             @2;
    monoparentalFamily @3;
    biparentalFamily   @4;
    other              @5;
    unknown            @6;
  }

}