/*
 * Copyright 2022 Polytechnique Montreal and contributors
 *
 * This software may be used and distributed according to the terms of the
 * GNU General Public License version 2 or any later version.
 *
 */

use std::error::Error;
use std::fmt;

#[derive(Debug)]
pub struct TrError {
    details: String
}

impl TrError {
    pub fn new(msg: &str) -> TrError {
        TrError{details: msg.to_string()}
    }
}

impl fmt::Display for TrError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f,"{}",self.details)
    }
}

impl Error for TrError {
    fn description(&self) -> &str {
        &self.details
    }
}