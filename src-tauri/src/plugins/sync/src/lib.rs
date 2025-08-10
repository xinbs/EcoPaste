use tauri::{plugin::PluginApi, AppHandle, Runtime};

pub use models::*;

#[cfg(desktop)]
mod desktop;
#[cfg(mobile)]
mod mobile;

mod commands;
mod error;
mod models;
mod auth;
mod device;
mod storage;
mod sync_engine;
mod websocket;
mod encryption;
mod conflict_resolver;

pub use error::{Error, Result};

#[cfg(desktop)]
use desktop::EcoSync;
#[cfg(mobile)]
use mobile::EcoSync;

/// Extensions to [`tauri::App`], [`tauri::AppHandle`] and [`tauri::Window`] to access the eco-sync APIs.
pub trait EcoSyncExt<R: Runtime> {
  fn eco_sync(&self) -> &EcoSync<R>;
}

impl<R: Runtime, T: tauri::Manager<R>> crate::EcoSyncExt<R> for T {
  fn eco_sync(&self) -> &EcoSync<R> {
    self.state::<EcoSync<R>>().inner()
  }
}

/// Initializes the plugin.
pub fn init<R: Runtime>() -> tauri::plugin::TauriPlugin<R> {
  tauri::plugin::Builder::new("eco-sync")
    .invoke_handler(tauri::generate_handler![
      commands::login,
      commands::register,
      commands::logout,
      commands::check_auth_status,
      commands::register_device,
      commands::get_devices,
      commands::remove_device,
      commands::update_device,
      commands::sync_data,
      commands::pull_updates,
      commands::force_sync_all,
      commands::get_sync_status,
      commands::resolve_conflict,
      commands::get_pending_conflicts,
      commands::update_sync_config,
      commands::get_sync_config,
      commands::start_sync_service,
      commands::stop_sync_service,
      commands::test_connection,
    ])
    .setup(|app, api| {
      #[cfg(mobile)]
      let eco_sync = mobile::init(app, api)?;
      #[cfg(desktop)]
      let eco_sync = desktop::init(app, api)?;
      app.manage(eco_sync);
      Ok(())
    })
    .build()
}