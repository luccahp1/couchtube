# Dev helper: focus the CouchTube dev Brave window and send it real mouse and
# keyboard input. Only ever targets the window whose handle you pass in, so it
# cannot wander into another browser session.
param(
  [Parameter(Mandatory = $true)][string]$Action, # focus | click | keys | text | rect
  [int]$Handle = 0,
  [int]$X = 0,
  [int]$Y = 0,
  [string]$Value = '',
  [int]$Repeat = 1,
  [int]$DelayMs = 90
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class CTWin {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint x, uint y, uint d, IntPtr e);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
  public const uint LEFTDOWN = 0x0002, LEFTUP = 0x0004;
}
"@

$h = [IntPtr]$Handle

function Focus-Win {
  [CTWin]::ShowWindow($h, 9) | Out-Null   # SW_RESTORE
  [CTWin]::SetForegroundWindow($h) | Out-Null
  Start-Sleep -Milliseconds 350
}

switch ($Action) {
  'focus' { Focus-Win; "focused $Handle" }
  'rect' {
    $r = New-Object CTWin+RECT
    [CTWin]::GetWindowRect($h, [ref]$r) | Out-Null
    "$($r.Left),$($r.Top),$($r.Right),$($r.Bottom)"
  }
  'click' {
    Focus-Win
    [CTWin]::SetCursorPos($X, $Y) | Out-Null
    Start-Sleep -Milliseconds 120
    [CTWin]::mouse_event([CTWin]::LEFTDOWN, 0, 0, 0, [IntPtr]::Zero)
    Start-Sleep -Milliseconds 45
    [CTWin]::mouse_event([CTWin]::LEFTUP, 0, 0, 0, [IntPtr]::Zero)
    "clicked $X,$Y"
  }
  'keys' {
    Focus-Win
    for ($i = 0; $i -lt $Repeat; $i++) {
      [System.Windows.Forms.SendKeys]::SendWait($Value)
      Start-Sleep -Milliseconds $DelayMs
    }
    "sent $Value x$Repeat"
  }
  'text' {
    Focus-Win
    [System.Windows.Forms.SendKeys]::SendWait($Value)
    "typed"
  }
}
