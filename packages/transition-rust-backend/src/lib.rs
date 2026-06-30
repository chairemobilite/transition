#![deny(clippy::all)]

#[macro_use]
extern crate napi_derive;

mod capnp_serialization;

pub use capnp_serialization::*;

#[napi]
pub fn sum(a: i32, b: i32) -> i32 {
  a + b
}

