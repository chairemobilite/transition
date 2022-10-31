@0xfa6a69e9ccb7fa72;

using Cxx = import "/capnp/c++.capnp";
$Cxx.namespace("householdCollection");

using Household = import "household.capnp".Household;

struct HouseholdCollection {
  households @0 :List(Household);
}

