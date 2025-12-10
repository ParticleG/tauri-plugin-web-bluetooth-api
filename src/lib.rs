use tauri::{
  plugin::{Builder, TauriPlugin},
  Manager, Runtime,
};

pub use models::*;

#[cfg(desktop)]
mod desktop;
#[cfg(mobile)]
mod mobile;

mod commands;
mod error;
mod models;

pub use error::{Error, Result};

#[cfg(desktop)]
use desktop::WebBluetooth;
#[cfg(mobile)]
use mobile::WebBluetooth;

/// Extensions to [`tauri::App`], [`tauri::AppHandle`] and [`tauri::Window`] to access the web-bluetooth APIs.
pub trait WebBluetoothExt<R: Runtime> {
  fn web_bluetooth(&self) -> &WebBluetooth<R>;
}

impl<R: Runtime, T: Manager<R>> crate::WebBluetoothExt<R> for T {
  fn web_bluetooth(&self) -> &WebBluetooth<R> {
    self.state::<WebBluetooth<R>>().inner()
  }
}

/// Initializes the plugin.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
  Builder::new("web-bluetooth")
    .invoke_handler(commands::handlers())
    .setup(|app, api| {
      #[cfg(mobile)]
      let web_bluetooth = mobile::init(app, api)?;
      #[cfg(desktop)]
      let web_bluetooth = desktop::init(app, api)?;
      app.manage(web_bluetooth);
      Ok(())
    })
    .build()
}
