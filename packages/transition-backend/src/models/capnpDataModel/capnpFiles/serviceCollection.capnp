@0xd86f051f59fb1b95;

using Cxx = import "/capnp/c++.capnp";
$Cxx.namespace("serviceCollection");

struct Service {
  uuid           @0  :Text;
  name           @1  :Text;
  internalId     @2  :Text;
  monday         @3  :Int8;
  tuesday        @4  :Int8;
  wednesday      @5  :Int8;
  thursday       @6  :Int8;
  friday         @7  :Int8;
  saturday       @8  :Int8;
  sunday         @9  :Int8;
  startDate      @10 :Text; # YYYY-MM-DD
  endDate        @11 :Text; # YYYY-MM-DD
  onlyDates      @12 :List(Text); # YYYY-MM-DD
  exceptDates    @13 :List(Text); # YYYY-MM-DD
  color          @14 :Text;
  isEnabled      @15 :Int8;
  description    @16 :Text;
  data           @17 :Text;
  isFrozen       @18 :Int8;
  simulationUuid @19 :Text;
}

struct ServiceCollection {
  services @0 :List(Service);
}


