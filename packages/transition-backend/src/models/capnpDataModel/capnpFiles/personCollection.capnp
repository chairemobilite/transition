@0xf9b31db38bb1e2ed;

using Cxx = import "/capnp/c++.capnp";
$Cxx.namespace("personCollection");

using Person = import "person.capnp".Person;

struct PersonCollection {
  persons @0 :List(Person);
}

