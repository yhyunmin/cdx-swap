using System.Diagnostics;
using System.Reflection;
using Microsoft.Win32;

namespace CdxSwap.Setup;

internal sealed record InstallResult(int ExitCode, string LogPath);

internal sealed class InstallFailedException : Exception
{
    public InstallFailedException(int exitCode, string? logPath, string message, Exception? innerException = null)
        : base(message, innerException)
    {
        ExitCode = exitCode;
        LogPath = logPath;
    }

    public int ExitCode { get; }

    public string? LogPath { get; }
}

internal sealed class InstallEngine
{
    private const string AppExecutableName = "cdx-swap.exe";

    public async Task<InstallResult> InstallAsync(IProgress<string> progress, CancellationToken cancellationToken)
    {
        progress.Report("Preparing installer");
        var tempDirectory = CreateTempDirectory();
        var logPath = CreateLogPath();

        try
        {
            var msiPath = await ExtractPayloadAsync(tempDirectory, cancellationToken);

            progress.Report("Installing cdx-swap");
            var exitCode = await RunMsiAsync(msiPath, logPath, cancellationToken);
            if (exitCode != 0)
            {
                throw new InstallFailedException(exitCode, logPath, "msiexec did not complete successfully.");
            }

            progress.Report("Creating shortcuts");
            await Task.Delay(500, cancellationToken);

            progress.Report("Finishing");
            TryDeleteDirectory(tempDirectory);
            return new InstallResult(exitCode, logPath);
        }
        catch (InstallFailedException)
        {
            throw;
        }
        catch (Exception error)
        {
            throw new InstallFailedException(-1, logPath, error.Message, error);
        }
    }

    public Task LaunchInstalledAppAsync()
    {
        var appPath = FindInstalledAppPath();
        if (appPath is null)
        {
            throw new FileNotFoundException("Installed cdx-swap executable was not found.");
        }

        Process.Start(new ProcessStartInfo
        {
            FileName = appPath,
            UseShellExecute = true,
        });

        return Task.CompletedTask;
    }

    public void OpenLog(string logPath)
    {
        Process.Start(new ProcessStartInfo
        {
            FileName = "explorer.exe",
            Arguments = $"/select,\"{logPath}\"",
            UseShellExecute = true,
        });
    }

    private static string CreateTempDirectory()
    {
        var path = Path.Combine(Path.GetTempPath(), "cdx-swap-setup", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(path);
        return path;
    }

    private static string CreateLogPath()
    {
        var timestamp = DateTime.Now.ToString("yyyyMMdd-HHmmss");
        return Path.Combine(Path.GetTempPath(), $"cdx-swap-install-{timestamp}.log");
    }

    private static async Task<string> ExtractPayloadAsync(string tempDirectory, CancellationToken cancellationToken)
    {
        var assembly = Assembly.GetExecutingAssembly();
        var resourceName = assembly
            .GetManifestResourceNames()
            .FirstOrDefault(name => string.Equals(name, BuildMetadata.PayloadResourceName, StringComparison.Ordinal))
            ?? assembly.GetManifestResourceNames().FirstOrDefault(name => name.EndsWith(".msi", StringComparison.OrdinalIgnoreCase));

        if (resourceName is null)
        {
            throw new InvalidOperationException("The setup payload MSI is missing from this installer build.");
        }

        await using var resource = assembly.GetManifestResourceStream(resourceName)
            ?? throw new InvalidOperationException($"Unable to open embedded payload resource '{resourceName}'.");

        var msiPath = Path.Combine(tempDirectory, "cdx-swap.msi");
        await using var file = File.Create(msiPath);
        await resource.CopyToAsync(file, cancellationToken);
        return msiPath;
    }

    private static async Task<int> RunMsiAsync(string msiPath, string logPath, CancellationToken cancellationToken)
    {
        using var process = Process.Start(new ProcessStartInfo
        {
            FileName = "msiexec.exe",
            UseShellExecute = false,
            CreateNoWindow = true,
        }.WithArguments(
            "/i",
            msiPath,
            "/qn",
            "/norestart",
            "ALLUSERS=2",
            "MSIINSTALLPERUSER=1",
            "/L*v",
            logPath));

        if (process is null)
        {
            throw new InvalidOperationException("Unable to start msiexec.exe.");
        }

        await process.WaitForExitAsync(cancellationToken);
        return process.ExitCode;
    }

    private static string? FindInstalledAppPath()
    {
        foreach (var candidate in GetKnownInstallCandidates())
        {
            if (File.Exists(candidate))
            {
                return candidate;
            }
        }

        return FindInstalledAppPathInRegistry();
    }

    private static IEnumerable<string> GetKnownInstallCandidates()
    {
        var localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        var programFiles = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
        var programFilesX86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);

        yield return Path.Combine(localAppData, "Programs", "cdx-swap", AppExecutableName);
        yield return Path.Combine(localAppData, "cdx-swap", AppExecutableName);
        yield return Path.Combine(programFiles, "cdx-swap", AppExecutableName);
        yield return Path.Combine(programFilesX86, "cdx-swap", AppExecutableName);
    }

    private static string? FindInstalledAppPathInRegistry()
    {
        foreach (var root in GetUninstallRoots())
        {
            using var key = root;
            if (key is null)
            {
                continue;
            }

            foreach (var subKeyName in key.GetSubKeyNames())
            {
                using var subKey = key.OpenSubKey(subKeyName);
                var displayName = subKey?.GetValue("DisplayName") as string;
                if (!string.Equals(displayName, "cdx-swap", StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                var installLocation = subKey?.GetValue("InstallLocation") as string;
                if (!string.IsNullOrWhiteSpace(installLocation))
                {
                    var candidate = Path.Combine(installLocation, AppExecutableName);
                    if (File.Exists(candidate))
                    {
                        return candidate;
                    }
                }
            }
        }

        return null;
    }

    private static IEnumerable<RegistryKey?> GetUninstallRoots()
    {
        yield return Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall");

        using var localMachine64 = RegistryKey.OpenBaseKey(RegistryHive.LocalMachine, RegistryView.Registry64);
        yield return localMachine64.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall");

        using var localMachine32 = RegistryKey.OpenBaseKey(RegistryHive.LocalMachine, RegistryView.Registry32);
        yield return localMachine32.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall");
    }

    private static void TryDeleteDirectory(string path)
    {
        try
        {
            if (Directory.Exists(path))
            {
                Directory.Delete(path, recursive: true);
            }
        }
        catch
        {
            // Temp payload cleanup is best-effort; the MSI log remains available separately.
        }
    }
}

internal static class ProcessStartInfoExtensions
{
    public static ProcessStartInfo WithArguments(this ProcessStartInfo startInfo, params string[] arguments)
    {
        foreach (var argument in arguments)
        {
            startInfo.ArgumentList.Add(argument);
        }

        return startInfo;
    }
}
