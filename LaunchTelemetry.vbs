Set WshShell = CreateObject("WScript.Shell")

' 1. Start the React UI server specifically on port 8086 (silently)
WshShell.CurrentDirectory = "C:\Users\Akshat\Downloads\pc-telemetry"
WshShell.Run "cmd /c serve -s dist -l 8086", 0, False

' Commented out below part as using livelywallpaper

' 2. THE CRITICAL DELAY: Wait 5 seconds (5000 milliseconds)
' This ensures Windows has fully initialized the internal HDMI port and the 5-inch screen is awake.
' WScript.Sleep 5000

' 3. Launch the browser in strict Kiosk Mode on the correct screen
' Replace 2560,0 with the actual coordinate of your mini display
' The --app-id or --user-data-dir flags ensure this doesn't conflict with your normal web browsing
' Dim browserPath
' browserPath = """C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"""
' Dim browserArgs
' browserArgs = "--kiosk http://localhost:8086 --window-position=2560,0"
' WshShell.Run browserPath & " " & browserArgs, 1, False