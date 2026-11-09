Set fso = CreateObject("Scripting.FileSystemObject")
Set WshShell = CreateObject("WScript.Shell")

' Run from the folder this script lives in, so no path to edit
WshShell.CurrentDirectory = fso.GetParentFolderName(WScript.ScriptFullName)

' Serve the production build on localhost only, silently
WshShell.Run "cmd /c serve -s dist -l tcp://127.0.0.1:8086", 0, False


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