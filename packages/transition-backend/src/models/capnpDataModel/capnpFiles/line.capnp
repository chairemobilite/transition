@0xd06a46d775e4e446;

using Cxx = import "/capnp/c++.capnp";
$Cxx.namespace("line");

struct Trip {
  uuid                      @0  :Text;
  pathUuid                  @1  :Text;
  departureTimeSeconds      @2  :Int32;
  arrivalTimeSeconds        @3  :Int32;
  nodeArrivalTimesSeconds   @4  :List(Int32);
  nodeDepartureTimesSeconds @5  :List(Int32);
  nodesCanBoard             @6  :List(Int8);
  nodesCanUnboard           @7  :List(Int8);
  blockUuid                 @8  :Text;
  totalCapacity             @9  :Int16; # total vehicle capacity for the trip
  seatedCapacity            @10 :Int16; # total seated capacity for this trip
  isFrozen                  @11 :Int8;
}

struct Period {
  periodShortname      @0 :Text;
  outboundPathUuid     @1 :Text;
  inboundPathUuid      @2 :Text;
  customStartAtSeconds @3 :Int32;
  startAtSeconds       @4 :Int32;
  endAtSeconds         @5 :Int32;
  intervalSeconds      @6 :Int16;
  numberOfUnits        @7 :Int16;
  trips                @8 :List(Trip);
  isFrozen             @9 :Int8;
  customEndAtSeconds  @10 :Int32;
  uuid                @11 :Text;
}

struct Schedule {
  uuid                       @0 :Text;
  serviceUuid                @1 :Text;
  periodsGroupShortname      @2 :Text;
  periods                    @3 :List(Period);
  allowSecondsBasedSchedules @4 :Int8;
  isFrozen                   @5 :Int8;
}

struct Line {
  uuid                   @0  :Text;
  internalId             @1  :Text;
  mode                   @2  :Text;
  category               @3  :Text;
  agencyUuid             @4  :Text;
  shortname              @5  :Text;
  longname               @6  :Text;
  color                  @7  :Text;
  isEnabled              @8  :Int8;
  description            @9  :Text;
  data                   @10 :Text;
  isAutonomous           @11 :Int8;
  allowSameLineTransfers @12 :Int8;
  schedules              @13 :List(Schedule);
  isFrozen               @14 :Int8;
}
