export interface DisposableEmailCheckerOptions {
    filePath?: string; // Path to a local blocklist file
    url?: string;      // URL to a remote blocklist file

    // New options for the upstream allowlist
    useUpstreamAllowlist?: boolean; // Set to true to enable loading the upstream allowlist
    upstreamAllowlistFilePath?: string; // Path to a local allowlist file (overrides default bundled/remote)
    upstreamAllowlistUrl?: string;      // URL to a remote allowlist file (overrides default bundled)
}
