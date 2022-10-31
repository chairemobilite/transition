@0x88340494115f60b3;

using Cxx = import "/capnp/c++.capnp";
$Cxx.namespace("odTrip");

struct OdTrip {

  uuid                        @0  :Text;
  personUuid                  @1  :Text;
  householdUuid               @2  :Text;
  dataSourceUuid              @3  :Text;
  id                          @4  :UInt32; # unique per data source
  expansionFactor             @5  :Float32;
  departureTimeSeconds        @6  :Int32;
  arrivalTimeSeconds          @7  :Int32;
  walkingTravelTimeSeconds    @8  :Int32;
  cyclingTravelTimeSeconds    @9  :Int32;
  drivingTravelTimeSeconds    @10 :Int32;
  mode                        @11 :Mode;
  originActivity              @12 :Activity;
  destinationActivity         @13 :Activity;
  originLatitude              @14 :Int32; # divide by 1000000 to get float
  originLongitude             @15 :Int32; # divide by 1000000 to get float
  destinationLatitude         @16 :Int32; # divide by 1000000 to get float
  destinationLongitude        @17 :Int32; # divide by 1000000 to get float
  originNodesUuids            @18 :List(Text);
  originNodesTravelTimes      @19 :List(Int16); # seconds
  originNodesDistances        @20 :List(Int16); # meters
  destinationNodesUuids       @21 :List(Text);
  destinationNodesTravelTimes @22 :List(Int16); # seconds
  destinationNodesDistances   @23 :List(Int16); # meters
  internalId                  @24 :Text;
  data                        @25 :Text; # json
  isFrozen                    @26 :Int8;
  
  enum Mode {
    none            @0 ;
    walking         @1 ;
    cycling         @2 ;
    carDriver       @3 ;
    carPassenger    @4 ;
    motorcycle      @5 ;
    transit         @6 ;
    paratransit     @7 ;
    taxi            @8 ;
    schoolBus       @9 ;
    otherBus        @10;
    intercityBus    @11;
    intercityTrain  @12;
    plane           @13;
    ferry           @14;
    parkAndRide     @15;
    kissAndRide     @16;
    bikeAndRide     @17;
    multimodalOther @18;
    other           @19;
    unknown         @20;
  }

  enum Activity {
    none            @0;
    home            @1;
    workUsual       @2;
    workNonUsual    @3;
    schoolUsual     @4;
    schoolNonUsual  @5;
    shopping        @6;
    leisure         @7;
    service         @8;
    secondaryHome   @9;
    visitingFriends @10;
    dropSomeone     @11;
    fetchSomeone    @12;
    restaurant      @13;
    medical         @14;
    worship         @15;
    onTheRoad       @16;
    other           @17;
    unknown         @18;
  }

}