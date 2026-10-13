using System;
using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Reflection;
using System.Text.Json;
using System.Threading.Tasks;

namespace ValorantTracker.Desktop.Services;

public sealed class BackendProcessManager
{
    private const string BackendResourceName = "ValorantTracker.Desktop.Resources.ValorantTrackerBackend.exe";
    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(1) };
    private static readonly int[] CandidatePorts = [3000, 3010, 3020, 3030];

    private Process? _backendProcess;
    private int _activePort = 3000;

    public string BaseUrl => $"http://127.0.0.1:{_activePort}";

    public async Task<BackendStartResult> EnsureBackendRunningAsync()
    {
        foreach (var port in CandidatePorts)
        {
            var existing = await GetHealthStatusAsync(port);
            if (existing.IsHealthy)
            {
                continue;
            }

            StartNewBackendProcess(port);

            for (var i = 0; i < 60; i++)
            {
                if (_backendProcess is { HasExited: true })
                {
                    break;
                }

                var health = await GetHealthStatusAsync(port);
                if (health.IsHealthy)
                {
                    _activePort = port;
                    return new BackendStartResult(true, $"Connected on port {port}");
                }

                await Task.Delay(250);
            }

            await StopAsync();
        }

        throw new InvalidOperationException("The local tracker service could not start. Close other tracker copies and try again.");
    }

    public async Task StopAsync()
    {
        if (_backendProcess is { HasExited: false })
        {
            try
            {
                _backendProcess.Kill(entireProcessTree: true);
                await _backendProcess.WaitForExitAsync();
            }
            catch
            {
                // Best-effort shutdown during application exit.
            }
        }

        _backendProcess?.Dispose();
        _backendProcess = null;
    }

    public Task<BackendHealthStatus> GetHealthStatusAsync() => GetHealthStatusAsync(_activePort);

    private static async Task<BackendHealthStatus> GetHealthStatusAsync(int port)
    {
        var baseUrl = $"http://127.0.0.1:{port}";
        try
        {
            using var response = await Http.GetAsync($"{baseUrl}/health");
            if (!response.IsSuccessStatusCode)
            {
                return new BackendHealthStatus(false, $"Service returned {(int)response.StatusCode}");
            }

            var payload = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(payload);
            var uptime = doc.RootElement.TryGetProperty("uptime", out var uptimeNode)
                ? uptimeNode.GetDouble().ToString("0")
                : "0";
            return new BackendHealthStatus(true, $"Local service online · {uptime}s uptime");
        }
        catch
        {
            return new BackendHealthStatus(false, "Local service unavailable");
        }
    }

    private void StartNewBackendProcess(int port)
    {
        var backendExe = ResolveBackendExecutable();
        _backendProcess = new Process
        {
            StartInfo = new ProcessStartInfo
            {
                FileName = backendExe,
                WorkingDirectory = Path.GetDirectoryName(backendExe)!,
                UseShellExecute = false,
                CreateNoWindow = true,
                WindowStyle = ProcessWindowStyle.Hidden
            },
            EnableRaisingEvents = true
        };

        _backendProcess.StartInfo.Environment["PORT"] = port.ToString();
        _backendProcess.StartInfo.Environment["VALORANT_TRACKER_DESKTOP"] = "1";
        _backendProcess.Start();
    }

    private static string ResolveBackendExecutable()
    {
        var assembly = Assembly.GetExecutingAssembly();
        using var resource = assembly.GetManifestResourceStream(BackendResourceName);
        if (resource is not null)
        {
            var version = assembly.GetName().Version?.ToString(3) ?? "2.0.0";
            var runtimeDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "ValorantTracker",
                "runtime",
                version);
            Directory.CreateDirectory(runtimeDir);

            var backendPath = Path.Combine(runtimeDir, "ValorantTrackerBackend.exe");
            if (!File.Exists(backendPath) || new FileInfo(backendPath).Length != resource.Length)
            {
                var temporaryPath = backendPath + ".new";
                using (var output = new FileStream(temporaryPath, FileMode.Create, FileAccess.Write, FileShare.None))
                {
                    resource.CopyTo(output);
                }

                File.Move(temporaryPath, backendPath, overwrite: true);
            }

            return backendPath;
        }

        // Developer fallback for unpackaged builds.
        var probe = new DirectoryInfo(AppContext.BaseDirectory);
        for (var i = 0; i < 8 && probe is not null; i++)
        {
            var candidate = Path.Combine(probe.FullName, "release", "staging", "ValorantTrackerBackend.exe");
            if (File.Exists(candidate)) return candidate;
            probe = probe.Parent;
        }

        throw new FileNotFoundException("The embedded tracker service is missing. Rebuild the desktop release.");
    }
}

public sealed record BackendStartResult(bool Started, string Message);

public sealed record BackendHealthStatus(bool IsHealthy, string Description);
