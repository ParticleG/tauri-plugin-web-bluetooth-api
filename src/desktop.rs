use serde::de::DeserializeOwned;
use tauri::{plugin::PluginApi, AppHandle, Runtime};

use crate::models::*;

pub fn init<R: Runtime, C: DeserializeOwned>(
  app: &AppHandle<R>,
  _api: PluginApi<R, C>,
) -> crate::Result<WebBluetooth<R>> {
  Ok(WebBluetooth(app.clone()))
}

/// Access to the web-bluetooth APIs.
pub struct WebBluetooth<R: Runtime>(AppHandle<R>);

impl<R: Runtime> WebBluetooth<R> {
  pub fn ping(&self, payload: PingRequest) -> crate::Result<PingResponse> {
    Ok(PingResponse {
      value: payload.value,
    })
  }
}
