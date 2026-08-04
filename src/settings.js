// Settings live in chrome.storage.sync so they follow the profile. Everything
// reads CT.settings.values synchronously after the first load resolves.
(function () {
  const DEFAULTS = {
    enabled: true,
    glyphs: 'xbox', // xbox | playstation | generic
    deadzone: 0.45,
    repeatDelay: 380, // ms before a held direction starts repeating
    repeatRate: 110, // ms between repeats once it gets going
    seekStep: 10, // seconds for a d-pad nudge
    seekStepBig: 60, // seconds for the shoulder buttons
    volumeStep: 5,
    hudTimeout: 3200, // ms of no input before the HUD fades
    bigMode: false, // couch zoom
    bigModeZoom: 1.3,
    hideCursor: true,
    keyboardFallback: false, // drive it with arrow keys, handy without a pad
    autoTheater: true, // widen the player when a watch page opens
  };

  const values = Object.assign({}, DEFAULTS);
  let ready;

  function load() {
    ready = new Promise((resolve) => {
      try {
        chrome.storage.sync.get(DEFAULTS, (stored) => {
          if (!chrome.runtime.lastError && stored) Object.assign(values, stored);
          resolve(values);
        });
      } catch (err) {
        // Extension context can be gone after a reload. Defaults still work.
        resolve(values);
      }
    });
    return ready;
  }

  function set(patch) {
    Object.assign(values, patch);
    try {
      chrome.storage.sync.set(patch);
    } catch (err) {
      /* nothing we can do, keep the in-memory value */
    }
    CT.bus.emit('settings', values);
  }

  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync') return;
      let touched = false;
      for (const [key, change] of Object.entries(changes)) {
        if (key in values) {
          values[key] = change.newValue;
          touched = true;
        }
      }
      if (touched) CT.bus.emit('settings', values);
    });
  } catch (err) {
    /* no storage access, defaults only */
  }

  CT.settings = { DEFAULTS, values, load, set, get ready() { return ready; } };
  load();
})();
