interface BaseDomainListSource {
    type: 'allow' | 'block';
}

/** A domain list loaded from a local file path. */
export interface FileDomainListSource extends BaseDomainListSource {
    filePath: string;
}

/** A domain list loaded from a remote URL. */
export interface UrlDomainListSource extends BaseDomainListSource {
    url: string;
}

/** A domain list provided as a raw array of domain strings. */
export interface DataDomainListSource extends BaseDomainListSource {
    list: string[];
}

/**
 * Discriminated union for a domain list source.
 * Exactly one of `filePath`, `url`, or `list` must be provided.
 */
export type DomainListSource = FileDomainListSource | UrlDomainListSource | DataDomainListSource;

export interface BurnerGuardOptions {
    /** API key for the BurnerGuard service. When set, verify() calls the remote API for enriched results. */
    apiKey?: string;

    /**
     * Risk score threshold for service mode (0.0–1.0). Domains with a riskScore at or above
     * this value are considered a match. Only applies when apiKey is set. Default: 0.5.
     */
    threshold?: number;

    /** Full-power domain list sources (file, URL, or inline array). */
    sources?: DomainListSource[];

    /** Shorthand: additional domains to block beyond the bundled list. */
    additionalBlockedDomains?: string[];

    /** Shorthand: additional domains to allow, overriding the blocklist. */
    additionalAllowedDomains?: string[];

    /** Whether to load the bundled blocklist. Defaults to true. */
    useBundledBlocklist?: boolean;

    /**
     * Whether to load the bundled allowlist. Defaults to false.
     * @deprecated The bundled allowlist is no longer maintained upstream and will be removed in a future major version. Use `additionalAllowedDomains` or a custom `sources` entry instead.
     */
    useBundledAllowlist?: boolean;
}

/** Options that can be passed per-call to override instance defaults. */
export interface VerifyOptions {
    /** Override the instance-level threshold for this call only. */
    threshold?: number;
}

/** Result from verifying a single email or domain (static mode). */
export interface VerifyResult {
    /** Whether the input matched the blocklist or exceeded the risk threshold. */
    isMatch: boolean;

    /** The extracted domain, or null if the input was not a valid email or domain. */
    domain: string | null;

    /** The primary signal that triggered the match (e.g., "blocklist"), or null if no match. */
    matchedOn: string | null;

    /** Whether the domain was found on the allowlist, overriding the blocklist. */
    isAllowlisted: boolean;
}

/** Risk signals returned by the BurnerGuard service. Each value is null when the signal could not be evaluated. */
export interface RiskSignals {
    /** Domain appears on a known blocklist (static or server-maintained). */
    blocklist: boolean | null;

    /** Days since domain registration. */
    domainAgeDays: number | null;

    /** MX fingerprint category (e.g., "catch-all", "gmail", "corporate"). */
    mxProvider: string | null;

    /** Domain accepts mail to any address. */
    catchAll: boolean | null;

    /** Address is a role address (info@, admin@, etc.). */
    roleAddress: boolean | null;

    /** Part of a known generation pattern. */
    patternCluster: boolean | null;

    /** Unusual signup volume detected. */
    velocity: boolean | null;
}

/** Enriched result from the BurnerGuard service (strict superset of VerifyResult). */
export interface EnrichedVerifyResult extends VerifyResult {
    /** The service's recommended action. */
    verdict: 'allow' | 'block' | 'suspect';

    /** Risk score from 0.0 (safe) to 1.0 (certain threat). */
    riskScore: number;

    /** Detailed signal breakdown. */
    signals: RiskSignals;
}

/** Result from filtering a list of emails/domains. */
export interface FilterResult {
    /** Emails/domains that matched the blocklist or exceeded the risk threshold. */
    matched: string[];

    /** Emails/domains that did not match (or were allowlisted). */
    clean: string[];
}
