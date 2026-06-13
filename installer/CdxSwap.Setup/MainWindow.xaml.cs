using Microsoft.UI.Windowing;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Media.Imaging;
using Windows.Graphics;

namespace CdxSwap.Setup;

public sealed partial class MainWindow : Window
{
    private readonly InstallEngine installEngine = new();
    private string? lastLogPath;

    public MainWindow()
    {
        InitializeComponent();
        ConfigureWindow();
        ShowReady();
    }

    private void ConfigureWindow()
    {
        ExtendsContentIntoTitleBar = true;
        SetTitleBar(DragRegion);

        var windowHandle = WinRT.Interop.WindowNative.GetWindowHandle(this);
        var windowId = Microsoft.UI.Win32Interop.GetWindowIdFromWindow(windowHandle);
        var appWindow = AppWindow.GetFromWindowId(windowId);
        appWindow.Resize(new SizeInt32(560, 510));

        var iconPath = Path.Combine(AppContext.BaseDirectory, "Assets", "icon.ico");
        if (File.Exists(iconPath))
        {
            appWindow.SetIcon(iconPath);
        }

        var imagePath = Path.Combine(AppContext.BaseDirectory, "Assets", "app-icon.png");
        if (File.Exists(imagePath))
        {
            AppIconImage.Source = new BitmapImage(new Uri(imagePath));
        }
    }

    private void ShowReady()
    {
        InstallButton.Content = "Install";
        InstallButton.Visibility = Visibility.Visible;
        InstallButton.IsEnabled = true;
        RetryButton.Visibility = Visibility.Collapsed;
        LaunchButton.Visibility = Visibility.Collapsed;
        OpenLogButton.Visibility = Visibility.Collapsed;
        LaunchAfterInstallToggle.Visibility = Visibility.Visible;
        InstallProgress.Visibility = Visibility.Collapsed;
        InstallProgress.IsActive = false;
        CloseButton.IsEnabled = true;

        VersionText.Text = $"Version {BuildMetadata.Version}";
        TitleText.Text = "Ready to install";
        DescriptionText.Text = "Install the modern tray app for switching Codex profiles and checking usage.";
        StatusText.Text = "cdx-swap will be installed for the current Windows user.";
        LogPathText.Text = string.Empty;
    }

    private void ShowInstalling(string status)
    {
        InstallButton.IsEnabled = false;
        RetryButton.Visibility = Visibility.Collapsed;
        LaunchButton.Visibility = Visibility.Collapsed;
        OpenLogButton.Visibility = Visibility.Collapsed;
        LaunchAfterInstallToggle.Visibility = Visibility.Collapsed;
        InstallProgress.Visibility = Visibility.Visible;
        InstallProgress.IsActive = true;
        CloseButton.IsEnabled = false;

        TitleText.Text = "Installing";
        DescriptionText.Text = "Keep this window open while Windows Installer applies the app payload.";
        StatusText.Text = status;
        LogPathText.Text = string.Empty;
    }

    private void ShowSuccess()
    {
        InstallButton.Visibility = Visibility.Visible;
        InstallButton.Content = "Close";
        InstallButton.IsEnabled = true;
        RetryButton.Visibility = Visibility.Collapsed;
        OpenLogButton.Visibility = Visibility.Collapsed;
        LaunchButton.Visibility = Visibility.Visible;
        InstallProgress.Visibility = Visibility.Collapsed;
        InstallProgress.IsActive = false;
        CloseButton.IsEnabled = true;

        TitleText.Text = "Installed";
        DescriptionText.Text = "cdx-swap is ready.";
        StatusText.Text = "Finishing";
        LogPathText.Text = string.Empty;
    }

    private void ShowFailure(InstallFailedException error)
    {
        lastLogPath = error.LogPath;
        InstallButton.Content = "Close";
        InstallButton.Visibility = Visibility.Visible;
        InstallButton.IsEnabled = true;
        RetryButton.Visibility = Visibility.Visible;
        OpenLogButton.Visibility = File.Exists(lastLogPath) ? Visibility.Visible : Visibility.Collapsed;
        LaunchButton.Visibility = Visibility.Collapsed;
        LaunchAfterInstallToggle.Visibility = Visibility.Collapsed;
        InstallProgress.Visibility = Visibility.Collapsed;
        InstallProgress.IsActive = false;
        CloseButton.IsEnabled = true;

        TitleText.Text = "Installation failed";
        DescriptionText.Text = "Windows Installer returned an error. The log path is kept for diagnosis.";
        StatusText.Text = $"Exit code {error.ExitCode}: {error.Message}";
        LogPathText.Text = lastLogPath ?? string.Empty;
    }

    private async void InstallButton_Click(object sender, RoutedEventArgs e)
    {
        if ((string?)InstallButton.Content == "Close")
        {
            Close();
            return;
        }

        await InstallAsync();
    }

    private async void RetryButton_Click(object sender, RoutedEventArgs e)
    {
        await InstallAsync();
    }

    private async Task InstallAsync()
    {
        try
        {
            ShowInstalling("Preparing installer");
            var progress = new Progress<string>(ShowInstalling);
            var result = await installEngine.InstallAsync(progress, CancellationToken.None);
            lastLogPath = result.LogPath;
            ShowSuccess();

            if (LaunchAfterInstallToggle.IsOn)
            {
                await LaunchInstalledAppAsync();
            }
        }
        catch (InstallFailedException error)
        {
            ShowFailure(error);
        }
        catch (Exception error)
        {
            ShowFailure(new InstallFailedException(-1, lastLogPath, error.Message, error));
        }
    }

    private async void LaunchButton_Click(object sender, RoutedEventArgs e)
    {
        await LaunchInstalledAppAsync();
    }

    private async Task LaunchInstalledAppAsync()
    {
        try
        {
            await installEngine.LaunchInstalledAppAsync();
            Close();
        }
        catch (Exception error)
        {
            TitleText.Text = "Launch failed";
            DescriptionText.Text = "The app was installed, but the launcher could not find the executable.";
            StatusText.Text = error.Message;
            LaunchButton.Visibility = Visibility.Visible;
            InstallButton.Content = "Close";
            InstallButton.Visibility = Visibility.Visible;
        }
    }

    private void OpenLogButton_Click(object sender, RoutedEventArgs e)
    {
        if (!string.IsNullOrWhiteSpace(lastLogPath) && File.Exists(lastLogPath))
        {
            installEngine.OpenLog(lastLogPath);
        }
    }

    private void CloseButton_Click(object sender, RoutedEventArgs e)
    {
        if (CloseButton.IsEnabled)
        {
            Close();
        }
    }
}
