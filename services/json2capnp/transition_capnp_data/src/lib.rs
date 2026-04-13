/*
 * Copyright 2025 Polytechnique Montreal and contributors
 *
 * This software may be used and distributed according to the terms of the
 * GNU General Public License version 2 or any later version.
 *
 */

mod utils;
pub mod serialization;

#[macro_use]
extern crate serde_json;

include!("./capnp/include.rs");
