// Service worker. Its whole job is doing the things a content script is not
// allowed to do from a gamepad press.
//
// Chromium does not count gamepad input as user activation, so
// element.requestFullscreen() from the pad is refused. Extension APIs have no
// such rule, so we fall back to putting the whole browser window fullscreen,
// which for a 10-foot setup is arguably the better result anyway.

// The worker owns the truth about window state. Page-side metrics like
// outerHeight vs screen.height cannot tell you reliably whether a window is
// fullscreen once more than one display with different scaling is involved.

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg) return;
  const windowId = sender.tab && sender.tab.windowId;

  if (msg.type === 'window-state') {
    if (windowId == null) {
      sendResponse({ ok: false, fullscreen: false });
      return;
    }
    chrome.windows.get(windowId, (win) => {
      sendResponse({
        ok: !chrome.runtime.lastError && !!win,
        fullscreen: !!win && win.state === 'fullscreen',
      });
    });
    return true;
  }

  if (msg.type === 'window-fullscreen') {
    if (windowId == null) {
      sendResponse({ ok: false, reason: 'no window' });
      return;
    }
    chrome.windows.get(windowId, (win) => {
      if (chrome.runtime.lastError || !win) {
        sendResponse({ ok: false, reason: 'window gone' });
        return;
      }
      const wanted = msg.on == null ? win.state !== 'fullscreen' : !!msg.on;
      chrome.windows.update(windowId, { state: wanted ? 'fullscreen' : 'normal' }, (updated) => {
        sendResponse({
          ok: !chrome.runtime.lastError,
          fullscreen: updated ? updated.state === 'fullscreen' : wanted,
        });
      });
    });
    return true;
  }
});
