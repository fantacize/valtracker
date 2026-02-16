Option Explicit

Dim shell, fso, baseDir, logsDir, backendLog, frontendLog
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

baseDir = fso.GetParentFolderName(WScript.ScriptFullName)
logsDir = baseDir & "\launcher-logs"
backendLog = logsDir & "\backend.log"
frontendLog = logsDir & "\frontend.log"

If Not fso.FolderExists(logsDir) Then
  fso.CreateFolder logsDir
End If

' Start backend hidden (use PowerShell like manual flow)
shell.Run "powershell -NoProfile -ExecutionPolicy Bypass -Command ""Set-Location -LiteralPath '" & baseDir & "\backend'; if (-not (Test-Path node_modules)) { npm install }; npm run dev *> '" & backendLog & "'""", 0, False

' Start frontend hidden (use PowerShell like manual flow)
shell.Run "powershell -NoProfile -ExecutionPolicy Bypass -Command ""Set-Location -LiteralPath '" & baseDir & "\frontend'; if (-not (Test-Path node_modules)) { npm install }; npm run dev *> '" & frontendLog & "'""", 0, False

If WaitForFrontend("http://127.0.0.1:5173", 600000) Then
  shell.Run "cmd /c start """" http://127.0.0.1:5173", 0, False
Else
  MsgBox "Frontend did not start in time. Check logs in: " & logsDir & vbCrLf & _
         "If needed, run start-tracker.bat to see live terminal errors.", vbExclamation, "Valorant Tracker"
End If

Function WaitForFrontend(url, timeoutMs)
  Dim http, startedAt
  startedAt = Now
  WaitForFrontend = False

  Do While (DateDiff("s", startedAt, Now) * 1000) < timeoutMs
    On Error Resume Next
    Set http = CreateObject("MSXML2.XMLHTTP")
    http.Open "GET", url, False
    http.Send
    If Err.Number = 0 Then
      If http.Status >= 200 And http.Status < 500 Then
        WaitForFrontend = True
        Exit Function
      End If
    End If
    Err.Clear
    On Error Goto 0

    If FrontendLogReady(frontendLog) Then
      WaitForFrontend = True
      Exit Function
    End If

    WScript.Sleep 1000
  Loop
End Function

Function FrontendLogReady(logPath)
  On Error Resume Next
  FrontendLogReady = False
  If Not fso.FileExists(logPath) Then Exit Function

  Dim file, txt
  Set file = fso.OpenTextFile(logPath, 1, False)
  txt = file.ReadAll()
  file.Close

  If InStr(1, txt, "http://localhost:5173", 1) > 0 Or InStr(1, txt, "ready in", 1) > 0 Then
    FrontendLogReady = True
  End If
  Err.Clear
  On Error Goto 0
End Function
