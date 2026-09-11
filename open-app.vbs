Set fso = CreateObject("Scripting.FileSystemObject")
Set WshShell = CreateObject("WScript.Shell")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.Run """" & scriptDir & "\start-server.bat""", 0, False
WScript.Sleep 1200
WshShell.Run "http://localhost:8080"
