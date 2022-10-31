@0xcdd4740831f7524a;

using Cxx = import "/capnp/c++.capnp";
$Cxx.namespace("lineCollection");

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
  isFrozen               @13 :Int8;
}

struct LineCollection {
  lines @0 :List(Line);
}