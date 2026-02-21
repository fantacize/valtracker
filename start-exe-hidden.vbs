Option Explicit

Dim shell, fso, baseDir, exePath, healthUrl
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

baseDir = fso.GetParentFolderName(WScript.ScriptFullName)
exePath = baseDir & "\release\ValorantTrackerBackend.exe"
healthUrl = "http://127.0.0.1:3000/health"

If Not fso.FileExists(exePath) Then
  MsgBox "Missing release\ValorantTrackerBackend.exe" & vbCrLf & _
         "Run build-exe.bat first.", vbExclamation, "Valorant Tracker"
  WScript.Quit 1
End If

' Start packaged backend with hidden window.
shell.Run "powershell -NoProfile -ExecutionPolicy Bypass -Command ""Start-Process -FilePath '" & exePath & "' -WindowStyle Hidden""", 0, False

If WaitForServer(healthUrl, 120000) Then
  shell.Run "cmd /c start """" http://127.0.0.1:3000", 0, False
Else
  MsgBox "Standalone backend did not start in time." & vbCrLf & _
         "Try running start-exe.bat to see errors.", vbExclamation, "Valorant Tracker"
End If

Function WaitForServer(url, timeoutMs)
  Dim http, startedAt
  startedAt = Now
  WaitForServer = False

  Do While (DateDiff("s", startedAt, Now) * 1000) < timeoutMs
    On Error Resume Next
    Set http = CreateObject("MSXML2.XMLHTTP")
    http.Open "GET", url, False
    http.Send
    If Err.Number = 0 Then
      If http.Status >= 200 And http.Status < 500 Then
        WaitForServer = True
        Exit Function
      End If
    End If
    Err.Clear
    On Error Goto 0
    WScript.Sleep 1000
  Loop
End Function
