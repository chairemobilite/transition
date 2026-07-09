/// This module provides binding to read and write the capnp cache files used by TrRouting
#[napi]
pub mod capnp_serialization {

  use napi::bindgen_prelude::AsyncTask;
  use napi::{Env, Task};
  use std::fs::File;
  use transition_capnp_data::serialization::*;

  // ===========================================================================
  // COLLECTION GENERICS
  //
  // Collection functions operate on a single file. The type-specific work is
  // erased behind a boxed closure that does the I/O and maps every error to
  // `napi::Error` up front, so each Task struct is plain and non-generic (which
  // keeps `AsyncTask<ConcreteTask>` in the return position, where a generic
  // param can't appear).
  // ===========================================================================

  // Generic collection write task: the boxed closure creates the file and writes to it.
  pub struct WriteCollectionTask {
    op: Box<dyn FnOnce() -> napi::Result<()> + Send>,
  }

  impl Task for WriteCollectionTask {
    type Output = ();
    type JsValue = ();

    fn compute(&mut self) -> napi::Result<Self::Output> {
      // Move the closure out (FnOnce can only be called once) and run it.
      let op = std::mem::replace(&mut self.op, Box::new(|| Ok(())));
      op()
    }

    fn resolve(&mut self, _env: Env, output: Self::Output) -> napi::Result<Self::JsValue> {
      Ok(output)
    }
  }

  fn write_collection_generic(
    file_path: String,
    json_str: String,
    writer: fn(&serde_json::Value, &mut File) -> Result<(), capnp::Error>,
  ) -> AsyncTask<WriteCollectionTask> {
    AsyncTask::new(WriteCollectionTask {
      op: Box::new(move || {
        // Parse the JSON payload; a malformed payload is a caller error (InvalidArg).
        let json: serde_json::Value = serde_json::from_str(&json_str)
          .map_err(|e| napi::Error::new(napi::Status::InvalidArg, e.to_string()))?;
        // Create (or truncate) the destination file, then delegate to the type-specific writer.
        let mut file = File::create(&file_path).map_err(|e| {
          napi::Error::new(
            napi::Status::GenericFailure,
            format!("Cannot create {}: {}", file_path, e),
          )
        })?;
        writer(&json, &mut file)
          .map_err(|e| napi::Error::new(napi::Status::GenericFailure, e.to_string()))
      }),
    })
  }

  // Generic collection read task: the boxed closure opens the file, reads and re-serializes.
  pub struct ReadCollectionTask {
    op: Box<dyn FnOnce() -> napi::Result<String> + Send>,
  }

  impl Task for ReadCollectionTask {
    type Output = String;
    type JsValue = String;

    fn compute(&mut self) -> napi::Result<Self::Output> {
      let op = std::mem::replace(&mut self.op, Box::new(|| Ok(String::new())));
      op()
    }

    fn resolve(&mut self, _env: Env, output: Self::Output) -> napi::Result<Self::JsValue> {
      Ok(output)
    }
  }

  fn read_collection_generic(
    file_path: String,
    reader: fn(&mut File) -> Result<serde_json::Value, capnp::Error>,
  ) -> AsyncTask<ReadCollectionTask> {
    AsyncTask::new(ReadCollectionTask {
      op: Box::new(move || {
        // Open the source file, surfacing the path in the error message for easier debugging.
        let mut file = File::open(&file_path).map_err(|e| {
          napi::Error::new(
            napi::Status::GenericFailure,
            format!("Cannot open {}: {}", file_path, e),
          )
        })?;
        // Delegate to the type-specific reader, then serialize the result back to a JSON string.
        let collection_json = reader(&mut file)
          .map_err(|e| napi::Error::new(napi::Status::GenericFailure, e.to_string()))?;
        serde_json::to_string(&collection_json)
          .map_err(|e| napi::Error::new(napi::Status::GenericFailure, e.to_string()))
      }),
    })
  }

  // ===========================================================================
  // OBJECT GENERICS
  //
  // Object functions operate on a cache DIRECTORY rather than a single file,
  // and the underlying library manages the file layout itself. The signatures
  // differ from the collection variants:
  //   - write_object takes (cache_directory_path: &str, json: &serde_json::Value)
  //   - read_object  takes (object_uuid: &String, cache_directory_path: &str)
  // Note read_object's first argument is `&String`, not `&str`, so the reader
  // pointer type has to match exactly.
  // ===========================================================================

  // Generic object write task: writes a single object into a cache directory.
  pub struct WriteObjectTask {
    op: Box<dyn FnOnce() -> napi::Result<()> + Send>,
  }

  impl Task for WriteObjectTask {
    type Output = ();
    type JsValue = ();

    fn compute(&mut self) -> napi::Result<Self::Output> {
      let op = std::mem::replace(&mut self.op, Box::new(|| Ok(())));
      op()
    }

    fn resolve(&mut self, _env: Env, output: Self::Output) -> napi::Result<Self::JsValue> {
      Ok(output)
    }
  }

  fn write_object_generic(
    cache_directory_path: String,
    json_str: String,
    writer: fn(&str, &serde_json::Value) -> Result<(), capnp::Error>,
  ) -> AsyncTask<WriteObjectTask> {
    AsyncTask::new(WriteObjectTask {
      op: Box::new(move || {
        // Parse the payload; a malformed payload is a caller error (InvalidArg).
        let json: serde_json::Value = serde_json::from_str(&json_str)
          .map_err(|e| napi::Error::new(napi::Status::InvalidArg, e.to_string()))?;
        // The library decides the on-disk filename from the object contents,
        // so we only hand it the target directory and the value.
        writer(&cache_directory_path, &json)
          .map_err(|e| napi::Error::new(napi::Status::GenericFailure, e.to_string()))
      }),
    })
  }

  // Generic object read task: reads a single object (by uuid) from a cache directory.
  pub struct ReadObjectTask {
    op: Box<dyn FnOnce() -> napi::Result<String> + Send>,
  }

  impl Task for ReadObjectTask {
    type Output = String;
    type JsValue = String;

    fn compute(&mut self) -> napi::Result<Self::Output> {
      let op = std::mem::replace(&mut self.op, Box::new(|| Ok(String::new())));
      op()
    }

    fn resolve(&mut self, _env: Env, output: Self::Output) -> napi::Result<Self::JsValue> {
      Ok(output)
    }
  }

  fn read_object_generic(
    object_uuid: String,
    cache_directory_path: String,
    reader: fn(&String, &str) -> Result<serde_json::Value, capnp::Error>,
  ) -> AsyncTask<ReadObjectTask> {
    AsyncTask::new(ReadObjectTask {
      op: Box::new(move || {
        // Look the object up by uuid within the cache directory, then serialize to a JSON string.
        let json = reader(&object_uuid, &cache_directory_path)
          .map_err(|e| napi::Error::new(napi::Status::GenericFailure, e.to_string()))?;
        serde_json::to_string(&json)
          .map_err(|e| napi::Error::new(napi::Status::GenericFailure, e.to_string()))
      }),
    })
  }

  // ===========================================================================
  // WRITE COLLECTIONS
  // ===========================================================================

  /// Write a line collection to a capnp file
  ///
  /// @param {string} filePath: path to the capnp file to write
  /// @param {string} jsonStr: json representation of the line collection as a string
  #[napi(ts_return_type = "Promise<void>")]
  pub fn write_line_collection(
    file_path: String,
    json_str: String,
  ) -> AsyncTask<WriteCollectionTask> {
    write_collection_generic(file_path, json_str, line_collection::write_collection)
  }

  /// Write a agency collection to a capnp file
  ///
  /// @param {string} filePath: path to the capnp file to write
  /// @param {string} jsonStr: json representation of the agency collection as a string
  #[napi(ts_return_type = "Promise<void>")]
  pub fn write_agency_collection(
    file_path: String,
    json_str: String,
  ) -> AsyncTask<WriteCollectionTask> {
    write_collection_generic(file_path, json_str, agency_collection::write_collection)
  }

  /// Write a node collection to a capnp file
  ///
  /// @param {string} filePath: path to the capnp file to write
  /// @param {string} jsonStr: json representation of the node collection as a string
  #[napi(ts_return_type = "Promise<void>")]
  pub fn write_node_collection(
    file_path: String,
    json_str: String,
  ) -> AsyncTask<WriteCollectionTask> {
    write_collection_generic(file_path, json_str, node_collection::write_collection)
  }

  /// Write a path collection to a capnp file
  ///
  /// @param {string} filePath: path to the capnp file to write
  /// @param {string} jsonStr: json representation of the path collection as a string
  #[napi(ts_return_type = "Promise<void>")]
  pub fn write_path_collection(
    file_path: String,
    json_str: String,
  ) -> AsyncTask<WriteCollectionTask> {
    write_collection_generic(file_path, json_str, path_collection::write_collection)
  }

  /// Write a scenario collection to a capnp file
  ///
  /// @param {string} filePath: path to the capnp file to write
  /// @param {string} jsonStr: json representation of the scenario collection as a string
  #[napi(ts_return_type = "Promise<void>")]
  pub fn write_scenario_collection(
    file_path: String,
    json_str: String,
  ) -> AsyncTask<WriteCollectionTask> {
    write_collection_generic(file_path, json_str, scenario_collection::write_collection)
  }

  /// Write a service collection to a capnp file
  ///
  /// @param {string} filePath: path to the capnp file to write
  /// @param {string} jsonStr: json representation of the service collection as a string
  #[napi(ts_return_type = "Promise<void>")]
  pub fn write_service_collection(
    file_path: String,
    json_str: String,
  ) -> AsyncTask<WriteCollectionTask> {
    write_collection_generic(file_path, json_str, service_collection::write_collection)
  }

  // ===========================================================================
  // WRITE OBJECTS
  // ===========================================================================

  /// Write a line object to a capnp file
  ///
  /// @param {string} cacheDirectoryPath: path to the directory where to create the file, will be named based on the uuid
  /// @param {string} jsonStr: json representation of the line object as a string
  #[napi(ts_return_type = "Promise<void>")]
  pub fn write_line_object(
    cache_directory_path: String,
    json_str: String,
  ) -> AsyncTask<WriteObjectTask> {
    write_object_generic(cache_directory_path, json_str, line::write_object)
  }

  /// Write a node object to a capnp file
  ///
  /// @param {string} cacheDirectoryPath: path to the directory where to create the file, will be named based on the uuid
  /// @param {string} jsonStr: json representation of the node object as a string
  #[napi(ts_return_type = "Promise<void>")]
  pub fn write_node_object(
    cache_directory_path: String,
    json_str: String,
  ) -> AsyncTask<WriteObjectTask> {
    write_object_generic(cache_directory_path, json_str, node::write_object)
  }

  // ===========================================================================
  // READ COLLECTIONS
  // ===========================================================================

  /// Read a line collection from a capnp file
  ///
  /// @param {string} filePath: path to the capnp file to read
  ///
  /// @returns {string}: json representation of the line collection as a string
  #[napi(ts_return_type = "Promise<string>")]
  pub fn read_line_collection(file_path: String) -> AsyncTask<ReadCollectionTask> {
    read_collection_generic(file_path, line_collection::read_collection)
  }

  /// Read a agency collection from a capnp file
  ///
  /// @param {string} filePath: path to the capnp file to read
  ///
  /// @returns {string}: json representation of the agency collection as a string
  #[napi(ts_return_type = "Promise<string>")]
  pub fn read_agency_collection(file_path: String) -> AsyncTask<ReadCollectionTask> {
    read_collection_generic(file_path, agency_collection::read_collection)
  }

  /// Read a node collection from a capnp file
  ///
  /// @param {string} filePath: path to the capnp file to read
  ///
  /// @returns {string}: json representation of the node collection as a string
  #[napi(ts_return_type = "Promise<string>")]
  pub fn read_node_collection(file_path: String) -> AsyncTask<ReadCollectionTask> {
    read_collection_generic(file_path, node_collection::read_collection)
  }

  /// Read a path collection from a capnp file
  ///
  /// @param {string} filePath: path to the capnp file to read
  ///
  /// @returns {string}: json representation of the path collection as a string
  #[napi(ts_return_type = "Promise<string>")]
  pub fn read_path_collection(file_path: String) -> AsyncTask<ReadCollectionTask> {
    read_collection_generic(file_path, path_collection::read_collection)
  }

  /// Read a scenario collection from a capnp file
  ///
  /// @param {string} filePath: path to the capnp file to read
  ///
  /// @returns {string}: json representation of the scenario collection as a string
  #[napi(ts_return_type = "Promise<string>")]
  pub fn read_scenario_collection(file_path: String) -> AsyncTask<ReadCollectionTask> {
    read_collection_generic(file_path, scenario_collection::read_collection)
  }

  /// Read a service collection from a capnp file
  ///
  /// @param {string} filePath: path to the capnp file to read
  ///
  /// @returns {string}: json representation of the service collection as a string
  #[napi(ts_return_type = "Promise<string>")]
  pub fn read_service_collection(file_path: String) -> AsyncTask<ReadCollectionTask> {
    read_collection_generic(file_path, service_collection::read_collection)
  }

  // ===========================================================================
  // READ OBJECTS
  // ===========================================================================

  /// Read a line object from a capnp file
  ///
  /// @param {string} objectUuid: uuid of the object to find the right file
  /// @param {string} cacheDirectoryPath: path to the directory where to find the file
  ///
  /// @returns {string}: json representation of the line object as a string
  #[napi(ts_return_type = "Promise<string>")]
  pub fn read_line_object(
    object_uuid: String,
    cache_directory_path: String,
  ) -> AsyncTask<ReadObjectTask> {
    read_object_generic(object_uuid, cache_directory_path, line::read_object)
  }

  /// Read a node object from a capnp file
  ///
  /// @param {string} objectUuid: uuid of the object to find the right file
  /// @param {string} cacheDirectoryPath: path to the directory where to find the file
  ///
  /// @returns {string}: json representation of the node object as a string
  #[napi(ts_return_type = "Promise<string>")]
  pub fn read_node_object(
    object_uuid: String,
    cache_directory_path: String,
  ) -> AsyncTask<ReadObjectTask> {
    read_object_generic(object_uuid, cache_directory_path, node::read_object)
  }
}
