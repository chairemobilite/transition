#![deny(clippy::all)]

#[macro_use]
extern crate napi_derive;

mod capnp_serialization;

// TODO This is just an temporary example function that we can expose
// and uses in the test to validate that the bindings work correctly
// Once we have actual simple functions we can remove it.
// (The capnp stuff relies on external files, so are not well suited for a simple unit test)
#[napi]
pub fn sum(a: i32, b: i32) -> i32 {
  a + b
}
