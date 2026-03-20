import type {BurnerGuardOptions, DomainListSource, FilterResult, VerifyOptions, VerifyResult} from './interfaces';

const BUNDLED_DATA_MODULE = './bundled-data';

const EMAIL_REGEXP = /^(?=.{1,254}$)(?=.{1,64}@)[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)$/;

export class BurnerGuard {
    private constructor(
        private blockedDomains: Set<string>,
        private allowedDomains: Set<string>,
        private readonly apiKey: string | undefined,
        private readonly threshold: number
    ) {}

    /** Number of domains in the blocklist. In service mode, this reflects the last-known cached count. */
    get blocklistSize(): number {
        return this.blockedDomains.size;
    }

    /** Number of domains in the allowlist. In service mode, this reflects the last-known cached count. */
    get allowlistSize(): number {
        return this.allowedDomains.size;
    }

    /**
     * Creates and initializes a BurnerGuard instance.
     *
     * - No `apiKey` → static mode (bundled blocklist, offline).
     * - With `apiKey` → service mode (calls the BurnerGuard API for enriched results).
     *
     * @param options - Configuration for data sources, API key, and threshold.
     * @returns A fully initialized BurnerGuard instance.
     */
    static async create(options?: BurnerGuardOptions): Promise<BurnerGuard> {
        const blockedDomains = new Set<string>();
        const allowedDomains = new Set<string>();

        const hasCustomSources = options?.sources !== undefined && options.sources.length > 0;

        const shouldLoadBundledBlocklist = options?.useBundledBlocklist ?? !hasCustomSources;
        if (shouldLoadBundledBlocklist) {
            const bundled = await import(BUNDLED_DATA_MODULE) as typeof import('./bundled-data');
            for (const domain of bundled.BUNDLED_BLOCKLIST) {
                blockedDomains.add(domain);
            }
        }

        if (options?.useBundledAllowlist) {
            const bundled = await import(BUNDLED_DATA_MODULE) as typeof import('./bundled-data');
            for (const domain of bundled.BUNDLED_ALLOWLIST) {
                allowedDomains.add(domain);
            }
        }

        if (hasCustomSources) {
            for (const source of options.sources!) {
                const domains = await this.loadDomainListSource(source);
                const targetSet = source.type === 'allow' ? allowedDomains : blockedDomains;
                for (const domain of domains) {
                    targetSet.add(domain);
                }
            }
        }

        if (options?.additionalBlockedDomains) {
            for (const domain of options.additionalBlockedDomains) {
                const trimmed = domain.trim().toLowerCase();
                if (trimmed !== '') {
                    blockedDomains.add(trimmed);
                }
            }
        }

        if (options?.additionalAllowedDomains) {
            for (const domain of options.additionalAllowedDomains) {
                const trimmed = domain.trim().toLowerCase();
                if (trimmed !== '') {
                    allowedDomains.add(trimmed);
                }
            }
        }

        const apiKey = options?.apiKey;
        const threshold = options?.threshold ?? 0.5;

        return new BurnerGuard(blockedDomains, allowedDomains, apiKey, threshold);
    }

    /**
     * Verifies a single email address or bare domain.
     *
     * - **Static mode**: checks against the local blocklist and allowlist.
     * - **Service mode**: calls the BurnerGuard API and returns an enriched result.
     *
     * Accepts either `"user@yopmail.com"` or `"yopmail.com"`.
     *
     * @param emailOrDomain - An email address or bare domain to verify.
     * @param options - Per-call overrides (e.g., threshold).
     */
    async verify(emailOrDomain: string, options?: VerifyOptions): Promise<VerifyResult> {
        if (this.apiKey) {
            return this.verifyRemote(emailOrDomain, options);
        }

        return this.verifyLocal(emailOrDomain);
    }

    /**
     * Verifies multiple emails/domains and returns a result for each.
     *
     * @param emailsOrDomains - Array of email addresses or bare domains.
     * @param options - Per-call overrides (e.g., threshold).
     */
    async verifyBatch(emailsOrDomains: string[], options?: VerifyOptions): Promise<VerifyResult[]> {
        return Promise.all(emailsOrDomains.map((input) => this.verify(input, options)));
    }

    /**
     * Splits emails/domains into matched and clean buckets.
     *
     * @param emailsOrDomains - Array of email addresses or bare domains.
     * @param options - Per-call overrides (e.g., threshold).
     */
    async filter(emailsOrDomains: string[], options?: VerifyOptions): Promise<FilterResult> {
        const matched: string[] = [];
        const clean: string[] = [];

        const results = await this.verifyBatch(emailsOrDomains, options);
        for (let i = 0; i < emailsOrDomains.length; i++) {
            if (results[i].isMatch) {
                matched.push(emailsOrDomains[i]);
            } else {
                clean.push(emailsOrDomains[i]);
            }
        }

        return {matched, clean};
    }

    /**
     * Returns true if at least one email/domain in the list is a match.
     *
     * @param emailsOrDomains - Array of email addresses or bare domains.
     * @param options - Per-call overrides (e.g., threshold).
     */
    async hasMatch(emailsOrDomains: string[], options?: VerifyOptions): Promise<boolean> {
        for (const input of emailsOrDomains) {
            const result = await this.verify(input, options);
            if (result.isMatch) {
                return true;
            }
        }
        return false;
    }

    /**
     * Adds a domain to the blocklist.
     * In static mode, this updates the local Set. In service mode (future),
     * this may also sync the rule to the BurnerGuard API.
     *
     * @param domain - The domain to block (e.g., "sketchy-domain.io").
     */
    async block(domain: string): Promise<void> {
        const trimmed = domain.trim();
        if (trimmed === '') {
            return;
        }
        this.blockedDomains.add(trimmed.toLowerCase());
        await Promise.resolve();
    }

    /**
     * Adds a domain to the allowlist, overriding the blocklist.
     * In static mode, this updates the local Set. In service mode (future),
     * this may also sync the rule to the BurnerGuard API.
     *
     * @param domain - The domain to allow (e.g., "mycompany.com").
     */
    async allow(domain: string): Promise<void> {
        const trimmed = domain.trim();
        if (trimmed === '') {
            return;
        }
        this.allowedDomains.add(trimmed.toLowerCase());
        await Promise.resolve();
    }

    /**
     * Extracts the domain from an email address.
     * @returns The lowercase domain, or null if the input is not a valid email.
     */
    extractDomain(email: string): string | null {
        const match = EMAIL_REGEXP.exec(email);
        return match ? match[1].toLowerCase() : null;
    }

    /** Validates whether a string conforms to standard email syntax. */
    isValidEmail(email: string): boolean {
        return EMAIL_REGEXP.test(email);
    }

    // region Private

    /**
     * Performs a local-only verification against the blocklist and allowlist.
     */
    private verifyLocal(emailOrDomain: string): VerifyResult {
        const domain = this.resolveDomain(emailOrDomain);
        if (!domain) {
            return {isMatch: false, domain: null, matchedOn: null, isAllowlisted: false};
        }

        if (this.isAllowlisted(domain)) {
            return {isMatch: false, domain, matchedOn: null, isAllowlisted: true};
        }

        if (this.isBlocked(domain)) {
            return {isMatch: true, domain, matchedOn: 'blocklist', isAllowlisted: false};
        }

        return {isMatch: false, domain, matchedOn: null, isAllowlisted: false};
    }

    /**
     * Calls the BurnerGuard API for an enriched verification result.
     * @throws Error until the service is available.
     */
    // eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/require-await
    private async verifyRemote(_emailOrDomain: string, _options?: VerifyOptions): Promise<VerifyResult> {
        // TODO: Implement when the BurnerGuard API is available.
        throw new Error(
            'BurnerGuard service mode is not yet available. '
            + 'Remove the apiKey option to use static mode, or visit https://burnerguard.com for updates.'
        );
    }

    /**
     * Resolves the input to a bare domain. If the input contains `@`, it is
     * treated as an email and the domain is extracted. Otherwise it is treated
     * as a bare domain.
     */
    private resolveDomain(emailOrDomain: string): string | null {
        if (!emailOrDomain || emailOrDomain.trim() === '') {
            return null;
        }

        if (emailOrDomain.includes('@')) {
            return this.extractDomain(emailOrDomain);
        }

        return emailOrDomain.trim().toLowerCase();
    }

    /**
     * Walks up the domain hierarchy looking for a blocklist match.
     * The allowlist is checked at each level and takes priority.
     */
    private isBlocked(domain: string): boolean {
        const parts = domain.split('.');

        for (let i = 0; i < parts.length - 1; i++) {
            const candidate = parts.slice(i).join('.');

            if (this.allowedDomains.has(candidate)) {
                return false;
            }

            if (this.blockedDomains.has(candidate)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Walks up the domain hierarchy looking for an allowlist match.
     */
    private isAllowlisted(domain: string): boolean {
        const parts = domain.split('.');

        for (let i = 0; i < parts.length - 1; i++) {
            const candidate = parts.slice(i).join('.');

            if (this.allowedDomains.has(candidate)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Loads domains from a source. File and URL sources dynamically import
     * Node.js modules (fs, path) so the core library stays browser-compatible.
     */
    private static async loadDomainListSource(source: DomainListSource): Promise<string[]> {
        if ('list' in source) {
            return this.processDomainList(source.list);
        }

        if ('filePath' in source) {
            const fs = await import('node:fs/promises');
            const content = await fs.readFile(source.filePath, {encoding: 'utf8'}).catch((error: unknown) => {
                const message = error instanceof Error ? error.message : String(error);
                throw new Error(`Failed to load custom ${source.type}list. ${message}`);
            });
            return this.processDomainList(content.split('\n'));
        }

        if ('url' in source) {
            const response = await fetch(source.url);
            if (!response.ok) {
                throw new Error(`Failed to fetch ${source.url}: ${response.statusText}`);
            }
            const content = await response.text();
            return this.processDomainList(content.split('\n'));
        }

        return [];
    }

    /**
     * Filters and normalizes a list of domain strings: trims whitespace,
     * removes blanks and comments, lowercases, deduplicates, and sorts.
     */
    private static processDomainList(lines: string[]): string[] {
        const domains = new Set<string>();

        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.length === 0 || trimmed.startsWith('#')) {
                continue;
            }
            domains.add(trimmed.toLowerCase());
        }

        return Array.from(domains).sort();
    }

    // endregion
}
