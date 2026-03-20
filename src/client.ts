import * as path from 'node:path';

import type {CheckResult, DomainListSource, EmailCheckerOptions, FilterResult} from './interfaces';
import {DomainListService} from './services';

const EMAIL_REGEXP = /^(?=.{1,254}$)(?=.{1,64}@)[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)$/;

export class EmailChecker {
    private static readonly BUNDLED_BLOCKLIST_PATH = path.resolve(__dirname, '..', 'data', 'BLOCKLIST');
    private static readonly BUNDLED_ALLOWLIST_PATH = path.resolve(__dirname, '..', 'data', 'ALLOWLIST');

    private constructor(
        private blockedDomains: Set<string>,
        private allowedDomains: Set<string>
    ) {}

    /** Number of domains in the blocklist. */
    get blocklistSize(): number {
        return this.blockedDomains.size;
    }

    /** Number of domains in the allowlist. */
    get allowlistSize(): number {
        return this.allowedDomains.size;
    }

    /**
     * Creates and initializes an EmailChecker instance.
     * @param options - Configuration for loading domain lists.
     * @returns A fully initialized EmailChecker instance.
     */
    static async create(options?: EmailCheckerOptions): Promise<EmailChecker> {
        const blockedDomains = new Set<string>();
        const allowedDomains = new Set<string>();

        const hasCustomSources = options?.sources !== undefined && options.sources.length > 0;

        const shouldLoadBundledBlocklist = options?.useBundledBlocklist ?? !hasCustomSources;
        if (shouldLoadBundledBlocklist) {
            try {
                const content = await DomainListService.loadFile(this.BUNDLED_BLOCKLIST_PATH, 'bundled blocklist');
                for (const domain of DomainListService.processDomainList(content)) {
                    blockedDomains.add(domain);
                }
            } catch (error) {
                if (!hasCustomSources) {
                    throw error;
                }
            }
        }

        if (options?.useBundledAllowlist) {
            try {
                const content = await DomainListService.loadFile(this.BUNDLED_ALLOWLIST_PATH, 'bundled allowlist');
                for (const domain of DomainListService.processDomainList(content)) {
                    allowedDomains.add(domain);
                }
            } catch {
                // Allowlist is optional; continue without it
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

        return new EmailChecker(blockedDomains, allowedDomains);
    }

    /**
     * Adds a domain to the blocklist for this instance.
     * @param domain - The domain to block (e.g., "sketchy-domain.io").
     */
    block(domain: string): void {
        const trimmed = domain.trim();
        if (trimmed === '') {
            return;
        }
        this.blockedDomains.add(trimmed.toLowerCase());
    }

    /**
     * Adds a domain to the allowlist, overriding the blocklist for this instance.
     * @param domain - The domain to allow (e.g., "mycompany.com").
     */
    allow(domain: string): void {
        const trimmed = domain.trim();
        if (trimmed === '') {
            return;
        }
        this.allowedDomains.add(trimmed.toLowerCase());
    }

    /**
     * Checks if an email address or bare domain is disposable.
     * Accepts either `"user@yopmail.com"` or `"yopmail.com"`.
     * Walks up the domain hierarchy to catch subdomains of blocked domains.
     */
    isDisposable(emailOrDomain: string): boolean {
        const domain = this.resolveDomain(emailOrDomain);
        if (!domain) {
            return false;
        }
        return this.findBlockedAncestor(domain) !== null;
    }

    /**
     * Returns a detailed result for a single email or domain check.
     * Useful for logging, debugging, or building UIs.
     */
    check(emailOrDomain: string): CheckResult {
        const domain = this.resolveDomain(emailOrDomain);
        if (!domain) {
            return {isDisposable: false, domain: null, matchedRule: null, isAllowlisted: false};
        }

        const allowlistMatch = this.findAllowedAncestor(domain);
        if (allowlistMatch !== null) {
            return {isDisposable: false, domain, matchedRule: null, isAllowlisted: true};
        }

        const blockedMatch = this.findBlockedAncestor(domain);
        if (blockedMatch !== null) {
            return {isDisposable: true, domain, matchedRule: blockedMatch, isAllowlisted: false};
        }

        return {isDisposable: false, domain, matchedRule: null, isAllowlisted: false};
    }

    /**
     * Splits emails into disposable and clean buckets.
     */
    filter(emails: string[]): FilterResult {
        const disposable: string[] = [];
        const clean: string[] = [];

        for (const email of emails) {
            if (this.isDisposable(email)) {
                disposable.push(email);
            } else {
                clean.push(email);
            }
        }

        return {disposable, clean};
    }

    /**
     * Returns true if at least one email in the list is disposable.
     */
    hasDisposable(emails: string[]): boolean {
        return emails.some((email) => this.isDisposable(email));
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
     * Returns the matching rule (e.g., "yopmail.com") or null.
     *
     * The allowlist is checked at each level and takes priority — if an
     * ancestor is allowlisted, the walk stops and returns null.
     */
    private findBlockedAncestor(domain: string): string | null {
        const parts = domain.split('.');

        for (let i = 0; i < parts.length - 1; i++) {
            const candidate = parts.slice(i).join('.');

            if (this.allowedDomains.has(candidate)) {
                return null;
            }

            if (this.blockedDomains.has(candidate)) {
                return candidate;
            }
        }

        return null;
    }

    /**
     * Walks up the domain hierarchy looking for an allowlist match.
     * Returns the matching domain or null.
     */
    private findAllowedAncestor(domain: string): string | null {
        const parts = domain.split('.');

        for (let i = 0; i < parts.length - 1; i++) {
            const candidate = parts.slice(i).join('.');

            if (this.allowedDomains.has(candidate)) {
                return candidate;
            }
        }

        return null;
    }

    private static async loadDomainListSource(source: DomainListSource): Promise<string[]> {
        if ('list' in source) {
            return DomainListService.processDomainList(source.list.join('\n'));
        }

        if ('filePath' in source) {
            const content = await DomainListService.loadFile(source.filePath, `custom ${source.type}list`);
            return DomainListService.processDomainList(content);
        }

        if ('url' in source) {
            const content = await DomainListService.fetchDomainList(source.url);
            return DomainListService.processDomainList(content);
        }

        return [];
    }

    // endregion
}
