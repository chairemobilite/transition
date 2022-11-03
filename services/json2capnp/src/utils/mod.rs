/*
 * Copyright 2022 Polytechnique Montreal and contributors
 *
 * This software may be used and distributed according to the terms of the
 * GNU General Public License version 2 or any later version.
 *
 */

use regex::Regex;

/*pub fn string_or_null_to_empty_string(input: &std::string::String) -> std::string::String {
    if input == "null" {
        std::string::String::from("")
    } else {
        input.clone()
    }
}*/

pub fn json_null_to_empty_str(input: &serde_json::Value) -> &str {
    if input.is_null() {
        ""
    } else {
        input.as_str().unwrap()
    }
}

/*pub fn empty_string_to_null(input: &std::string::String) -> std::string::String {
    if input == "" {
        String::from("null")
    } else {
        input.clone()
    }
}*/

pub fn empty_str_to_json_null(input: &str) -> serde_json::Value {
    if input == "" {
        json!(null)
    } else {
        json!(input)
    }
}

/*pub fn string_or_null_to_minus_one(input: &std::string::String) -> std::string::String {
    if input == "null" {
        std::string::String::from("-1")
    } else {
        input.clone()
    }
}*/

pub fn json_value_or_null_to_i64_or_minus_one(input: &serde_json::Value) -> i64 {
    match input.as_i64() {
        Some(value) => value,
        None => -1,
    }
}

pub fn json_value_or_null_to_f64_or_minus_one(input: &serde_json::Value) -> f64 {
    match input.as_f64() {
        Some(value) => value,
        None => -1.0,
    }
}

pub fn minus_one_i64_to_null(input: i64) -> serde_json::Value {
    if input == -1 {
        json!(null)
    } else {
        json!(input)
    }
}

pub fn minus_one_f64_to_null(input: f64) -> serde_json::Value {
    if input == -1.0 {
        json!(null)
    } else {
        json!(input)
    }
}

pub fn json_boolean_to_i8(input: &serde_json::Value) -> i8 {
    match input.as_bool() {
        Some(true) => 1,
        Some(false) => 0,
        None => -1,
    }
}

pub fn i8_to_json_boolean(input: i8) -> serde_json::Value {
    match input {
        1 => json!(true),
        0 => json!(false),
        -1 => json!(null),
        _ => json!(null),
    }
}

pub fn optional_string_json_null_to_empty_str(input: Option<&serde_json::Value>) -> &str {
    &json_null_to_empty_str(input.unwrap_or(&json!(null)))
}

pub fn required_string(input: Option<&serde_json::Value>) -> &str {
    &input.unwrap().as_str().unwrap()
}

pub fn time_str_to_seconds_since_midnight(time_str: &str) -> Option<u32> {
    let time_regex = Regex::new(r"(\d{2}):(\d{2}):?(\d{2})?").unwrap();
    if !time_regex.is_match(time_str)
    {
        return None;
    }
    let splitted_time = time_str.split(":");
    let mut i : u8 = 0;
    let mut seconds : u32 = 0;
    for s in splitted_time {
        if i == 0 // hours
        {
            seconds += 3600 * s.parse::<u32>().unwrap();
        }
        else if i == 1 // minutes
        {
            seconds += 60 * s.parse::<u32>().unwrap();
        }
        else if i == 2 // seconds (optional)
        {
            seconds += s.parse::<u32>().unwrap();
        }
        i += 1;
    }
    Some(seconds)
}

pub fn seconds_since_midnight_to_time_str(&seconds_since_midnight: &u32) -> String {
    let hours = seconds_since_midnight/3600;
    let minutes = (seconds_since_midnight - hours * 3600)/60;
    let seconds = seconds_since_midnight - hours * 3600 - minutes * 60;
    let time_string = if seconds == 0 { format!("{:02}:{:02}", hours, minutes) } else { format!("{:02}:{:02}:{:02}", hours, minutes, seconds) };
    time_string
}