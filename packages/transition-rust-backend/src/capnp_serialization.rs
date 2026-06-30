
#[napi]
pub mod capnp_serialization {
    
    use transition_capnp_data::serialization::*;
    use std::fs::File;
    
    #[napi(object)]
    pub fn write_line_collection(file_path: String, json_str: String) -> napi::Result<()> {
        let json: serde_json::Value = serde_json::from_str(&json_str)
            .map_err(|e| napi::Error::new(napi::Status::InvalidArg, e.to_string()))?;
        
        let mut file = File::create(file_path)?;
        line_collection::write_collection(&json, &mut file)
            .map_err(|e| napi::Error::new(napi::Status::GenericFailure, e.to_string()))
    }
    
    #[napi(object)]
    pub fn write_agency_collection(file_path: String, json_str: String) -> napi::Result<()> {
        let json: serde_json::Value = serde_json::from_str(&json_str)
            .map_err(|e| napi::Error::new(napi::Status::InvalidArg, e.to_string()))?;
        
        let mut file = File::create(file_path)?;
        agency_collection::write_collection(&json, &mut file)
            .map_err(|e| napi::Error::new(napi::Status::GenericFailure, e.to_string()))
    }

    #[napi(object)]
    pub fn write_node_collection(file_path: String, json_str: String) -> napi::Result<()> {
        let json: serde_json::Value = serde_json::from_str(&json_str)
            .map_err(|e| napi::Error::new(napi::Status::InvalidArg, e.to_string()))?;
        
        let mut file = File::create(file_path)?;
        node_collection::write_collection(&json, &mut file)
            .map_err(|e| napi::Error::new(napi::Status::GenericFailure, e.to_string()))
    }

    #[napi(object)]
    pub fn write_path_collection(file_path: String, json_str: String) -> napi::Result<()> {
        let json: serde_json::Value = serde_json::from_str(&json_str)
            .map_err(|e| napi::Error::new(napi::Status::InvalidArg, e.to_string()))?;
        
        let mut file = File::create(file_path)?;
        path_collection::write_collection(&json, &mut file)
            .map_err(|e| napi::Error::new(napi::Status::GenericFailure, e.to_string()))
    }    

    #[napi(object)]
    pub fn write_scenario_collection(file_path: String, json_str: String) -> napi::Result<()> {
        let json: serde_json::Value = serde_json::from_str(&json_str)
            .map_err(|e| napi::Error::new(napi::Status::InvalidArg, e.to_string()))?;
        
        let mut file = File::create(file_path)?;
        scenario_collection::write_collection(&json, &mut file)
            .map_err(|e| napi::Error::new(napi::Status::GenericFailure, e.to_string()))
    }

    #[napi(object)]
    pub fn write_service_collection(file_path: String, json_str: String) -> napi::Result<()> {
        let json: serde_json::Value = serde_json::from_str(&json_str)
            .map_err(|e| napi::Error::new(napi::Status::InvalidArg, e.to_string()))?;
        
        let mut file = File::create(file_path)?;
        service_collection::write_collection(&json, &mut file)
            .map_err(|e| napi::Error::new(napi::Status::GenericFailure, e.to_string()))
    }

    #[napi(object)]
    pub fn write_line_object(cache_directory_path: String, json_str: String) -> napi::Result<()> {
        let json: serde_json::Value = serde_json::from_str(&json_str)
            .map_err(|e| napi::Error::new(napi::Status::InvalidArg, e.to_string()))?;
        
        line::write_object(&cache_directory_path, &json)
            .map_err(|e| napi::Error::new(napi::Status::GenericFailure, e.to_string()))
    }

    #[napi(object)]
    pub fn write_node_object(cache_directory_path: String, json_str: String) -> napi::Result<()> {
        let json: serde_json::Value = serde_json::from_str(&json_str)
            .map_err(|e| napi::Error::new(napi::Status::InvalidArg, e.to_string()))?;
        
        node::write_object(&cache_directory_path, &json)
            .map_err(|e| napi::Error::new(napi::Status::GenericFailure, e.to_string()))
    }
    
    
}
