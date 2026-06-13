using System.Linq;
using System.Reflection;

namespace CdxSwap.Setup;

internal static class BuildMetadata
{
    public const string PayloadResourceName = "CdxSwap.Setup.Payload.cdx-swap.msi";

    public static string Version
    {
        get
        {
            var metadata = typeof(BuildMetadata)
                .Assembly
                .GetCustomAttributes<AssemblyMetadataAttribute>()
                .FirstOrDefault(attribute => attribute.Key == "CdxSwapVersion");

            return string.IsNullOrWhiteSpace(metadata?.Value) ? "0.0.0-local" : metadata.Value;
        }
    }
}
