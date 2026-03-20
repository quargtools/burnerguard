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

export interface EmailCheckerOptions {
    /** Full-power domain list sources (file, URL, or inline array). */
    sources?: DomainListSource[];

    /** Shorthand: additional domains to block beyond the bundled list. */
    additionalBlockedDomains?: string[];

    /** Shorthand: additional domains to allow, overriding the blocklist. */
    additionalAllowedDomains?: string[];

    /** Whether to load the bundled blocklist. Defaults to true. */
    useBundledBlocklist?: boolean;

    /** Whether to load the bundled allowlist. Defaults to false. */
    useBundledAllowlist?: boolean;
}

/** Detailed result from a single disposability check. */
export interface CheckResult {
    /** Whether the input was determined to be disposable. */
    isDisposable: boolean;

    /** The extracted domain, or null if the input was not a valid email. */
    domain: string | null;

    /** The blocklist domain that matched (e.g., "yopmail.com" when checking "sub.yopmail.com"), or null. */
    matchedRule: string | null;

    /** Whether the domain was found on the allowlist, overriding the blocklist. */
    isAllowlisted: boolean;
}

/** Result from filtering a list of emails/domains. */
export interface FilterResult {
    /** Emails whose domains are on the blocklist. */
    disposable: string[];

    /** Emails whose domains are not on the blocklist (or are allowlisted). */
    clean: string[];
}

