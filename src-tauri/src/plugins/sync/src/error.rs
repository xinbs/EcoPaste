use serde::{Deserialize, Serialize};

pub type Result<T> = std::result::Result<T, Error>;

#[derive(Debug, thiserror::Error, Serialize, Deserialize)]
pub enum Error {
  #[error("Authentication failed: {0}")]
  AuthenticationFailed(String),

  #[error("Network error: {0}")]
  NetworkError(String),

  #[error("Database error: {0}")]
  DatabaseError(String),

  #[error("Encryption error: {0}")]
  EncryptionError(String),

  #[error("Sync conflict: {0}")]
  SyncConflict(String),

  #[error("Device not found: {0}")]
  DeviceNotFound(String),

  #[error("Invalid configuration: {0}")]
  InvalidConfiguration(String),

  #[error("Service unavailable: {0}")]
  ServiceUnavailable(String),

  #[error("Serialization error: {0}")]
  SerializationError(String),

  #[error("IO error: {0}")]
  IoError(String),

  #[error("Unknown error: {0}")]
  Unknown(String),
}

impl From<reqwest::Error> for Error {
  fn from(err: reqwest::Error) -> Self {
    Error::NetworkError(err.to_string())
  }
}

impl From<sqlx::Error> for Error {
  fn from(err: sqlx::Error) -> Self {
    Error::DatabaseError(err.to_string())
  }
}

impl From<serde_json::Error> for Error {
  fn from(err: serde_json::Error) -> Self {
    Error::SerializationError(err.to_string())
  }
}

impl From<std::io::Error> for Error {
  fn from(err: std::io::Error) -> Self {
    Error::IoError(err.to_string())
  }
}

impl From<aes_gcm::Error> for Error {
  fn from(err: aes_gcm::Error) -> Self {
    Error::EncryptionError(err.to_string())
  }
}

impl From<jsonwebtoken::errors::Error> for Error {
  fn from(err: jsonwebtoken::errors::Error) -> Self {
    Error::AuthenticationFailed(err.to_string())
  }
}

// Tauri command error handling
impl serde::Serialize for Error {
  fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
  where
    S: serde::ser::Serializer,
  {
    serializer.serialize_str(self.to_string().as_ref())
  }
}