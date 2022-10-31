@0x9b44b39f61ff2481;

using Cxx = import "/capnp/c++.capnp";
$Cxx.namespace("scenarioCollection");

struct Scenario {
  uuid                  @0  :Text;
  name                  @1  :Text;
  color                 @2  :Text;
  isEnabled             @3  :Int8;
  description           @4  :Text;
  data                  @5  :Text;
  servicesUuids         @6  :List(Text);
  onlyLinesUuids        @7  :List(Text);
  exceptLinesUuids      @8  :List(Text);
  onlyAgenciesUuids     @9  :List(Text);
  exceptAgenciesUuids   @10 :List(Text);
  onlyNodesUuids        @11 :List(Text);
  exceptNodesUuids      @12 :List(Text);
  onlyModesShortnames   @13 :List(Text);
  exceptModesShortnames @14 :List(Text);
  isFrozen              @15 :Int8;
  simulationUuid        @16 :Text;
}

struct ScenarioCollection {
  scenarios @0 :List(Scenario);
}


