@0xff526f818562f0b2;

using Cxx = import "/capnp/c++.capnp";
$Cxx.namespace("person");

struct Person {
  
  uuid                             @0  :Text;
  dataSourceUuid                   @1  :Text;
  householdUuid                    @2  :Text;
  id                               @3  :UInt32;
  expansionFactor                  @4  :Float32;
  age                              @5  :Int16;
  drivingLicenseOwner              @6  :Int8;
  transitPassOwner                 @7  :Int8;
  ageGroup                         @8  :AgeGroup;
  gender                           @9  :Gender;
  occupation                       @10 :Occupation;
  usualWorkPlaceLatitude           @11 :Int32; # divide by 1000000 to get float, -1 means null
  usualWorkPlaceLongitude          @12 :Int32; # divide by 1000000 to get float, -1 means null
  usualSchoolPlaceLatitude         @13 :Int32; # divide by 1000000 to get float, -1 means null
  usualSchoolPlaceLongitude        @14 :Int32; # divide by 1000000 to get float, -1 means null
  usualWorkPlaceNodesUuids         @15 :List(Text);
  usualWorkPlaceNodesTravelTimes   @16 :List(Int16); # seconds
  usualWorkPlaceNodesDistances     @17 :List(Int16); # meters
  usualSchoolPlaceNodesUuids       @18 :List(Text);
  usualSchoolPlaceNodesTravelTimes @19 :List(Int16); # seconds
  usualSchoolPlaceNodesDistances   @20 :List(Int16); # meters
  internalId                       @21 :Text;
  data                             @22 :Text; # json
  isFrozen                         @23 :Int8;
  usualWorkPlaceWalkingTravelTimeSeconds   @24 :Int32;
  usualWorkPlaceCyclingTravelTimeSeconds   @25 :Int32;
  usualWorkPlaceDrivingTravelTimeSeconds   @26 :Int32;
  usualSchoolPlaceWalkingTravelTimeSeconds @27 :Int32;
  usualSchoolPlaceCyclingTravelTimeSeconds @28 :Int32;
  usualSchoolPlaceDrivingTravelTimeSeconds @29 :Int32;

  enum AgeGroup {
    none     @0 ;
    ag0004   @1 ;
    ag0509   @2 ;
    ag1014   @3 ;
    ag1519   @4 ;
    ag2024   @5 ;
    ag2529   @6 ;
    ag3034   @7 ;
    ag3539   @8 ;
    ag4044   @9 ;
    ag4549   @10;
    ag5054   @11;
    ag5559   @12;
    ag6064   @13;
    ag6569   @14;
    ag7074   @15;
    ag7579   @16;
    ag8084   @17;
    ag8589   @18;
    ag9094   @19;
    ag95plus @20;
    unknown  @21;
  }

  enum Gender {
    none    @0;
    female  @1;
    male    @2;
    custom  @3;
    unknown @4;
  }

  enum Occupation {
    none             @0;
    fullTimeWorker   @1;
    partTimeWorker   @2;
    fullTimeStudent  @3;
    partTimeStudent  @4;
    workerAndStudent @5;
    retired          @6;
    atHome           @7;
    other            @8;
    nonApplicable    @9;
    unknown          @10;
  }

}