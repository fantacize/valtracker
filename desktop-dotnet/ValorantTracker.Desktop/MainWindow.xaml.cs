using System;
using System.ComponentModel;
using System.Diagnostics;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Input;
using Microsoft.Web.WebView2.Core;
using ValorantTracker.Desktop.Services;

namespace ValorantTracker.Desktop;

public partial class MainWindow : Window
{
    private readonly BackendProcessManager _backend = new();
    private readonly PeriodicTimer _statusTimer = new(TimeSpan.FromSeconds(5));
    private readonly CancellationTokenSource _statusCts = new();
    private bool _allowClose;

    public MainWindow()
    {
        InitializeComponent();
        Loaded += OnLoaded;
        Closing += OnClosing;
    }

    private async void OnLoaded(object sender, RoutedEventArgs e)
    {
        try
        {
            ShellStatusText.Text = "Starting local service…";
            await _backend.EnsureBackendRunningAsync();

            await MainWebView.EnsureCoreWebView2Async();
            ConfigureWebView(MainWebView.CoreWebView2);
            MainWebView.Source = new Uri(_backend.BaseUrl);
            ShellStatusText.Text = "Connected";

            _ = RunStatusLoopAsync(_statusCts.Token);
        }
        catch (Exception ex)
        {
            MessageBox.Show(this,
                $"Valorant Tracker could not start.\n\n{ex.Message}",
                "Startup error",
                MessageBoxButton.OK,
                MessageBoxImage.Error);
            _allowClose = true;
            Close();
        }
    }

    private static void ConfigureWebView(CoreWebView2 webView)
    {
        webView.Settings.AreDefaultContextMenusEnabled = false;
        webView.Settings.AreDevToolsEnabled = false;
        webView.Settings.IsStatusBarEnabled = false;
        webView.Settings.IsZoomControlEnabled = false;
        webView.NewWindowRequested += (_, args) =>
        {
            if (Uri.TryCreate(args.Uri, UriKind.Absolute, out var uri) &&
                (uri.Scheme == Uri.UriSchemeHttps || uri.Scheme == Uri.UriSchemeHttp))
            {
                Process.Start(new ProcessStartInfo(uri.ToString()) { UseShellExecute = true });
            }
            args.Handled = true;
        };
    }

    private async Task RunStatusLoopAsync(CancellationToken token)
    {
        try
        {
            while (await _statusTimer.WaitForNextTickAsync(token))
            {
                var status = await _backend.GetHealthStatusAsync();
                await Dispatcher.InvokeAsync(() =>
                    ShellStatusText.Text = status.IsHealthy ? "Connected" : "Reconnecting…");
            }
        }
        catch (OperationCanceledException)
        {
            // Expected during application shutdown.
        }
    }

    private void TitleBar_OnMouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        if (e.ClickCount == 2)
        {
            ToggleMaximize();
            return;
        }
        DragMove();
    }

    private void MinimizeButton_OnClick(object sender, RoutedEventArgs e) => WindowState = WindowState.Minimized;

    private void MaximizeButton_OnClick(object sender, RoutedEventArgs e) => ToggleMaximize();

    private void ToggleMaximize() =>
        WindowState = WindowState == WindowState.Maximized ? WindowState.Normal : WindowState.Maximized;

    private void CloseButton_OnClick(object sender, RoutedEventArgs e)
    {
        _allowClose = true;
        Close();
    }

    private async void OnClosing(object? sender, CancelEventArgs e)
    {
        if (!_allowClose)
        {
            _allowClose = true;
        }

        _statusCts.Cancel();
        _statusTimer.Dispose();
        await _backend.StopAsync();
        _statusCts.Dispose();
    }
}
