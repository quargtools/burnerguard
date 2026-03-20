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

export interface DisposableEmailCheckerOptions {
    domainLists?: DomainListSource[];
    useBundledBlocklist?: boolean;
    useBundledAllowlist?: boolean;
}

/** Configuration for the update-blocklist script. */
export interface ListOptions {
    url: string;
    outputPath: string;
    listName: string;
}
