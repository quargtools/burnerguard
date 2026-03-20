import * as path from 'node:path';

import type {DisposableEmailCheckerOptions, DomainListSource} from './interfaces';
import {DomainListService} from './services';

const EMAIL_REGEXP = /^(?=.{1,254}$)(?=.{1,64}@)[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)$/;

export class DisposableEmailChecker {
    private static readonly BUNDLED_BLOCKLIST_PATH = path.resolve(__dirname, '..', 'data', 'BLOCKLIST');
    private static readonly BUNDLED_ALLOWLIST_PATH = path.resolve(__dirname, '..', 'data', 'ALLOWLIST');

    private constructor(
        private disposableDomains: Set<string>,
        private allowedDomains: Set<string>
    ) {}

    /**
     * Asynchronously creates and initializes a DisposableEmailChecker instance.
     * @param options - Configuration for loading domain lists.
     * @returns A fully initialized DisposableEmailChecker instance.
     */
    static async create(options?: DisposableEmailCheckerOptions): Promise<DisposableEmailChecker> {
        const disposableDomains = new Set<string>();
        const allowedDomains = new Set<string>();

        const hasCustomLists = options?.domainLists !== undefined && options.domainLists.length > 0;

        const shouldLoadBundledBlocklist = options?.useBundledBlocklist ?? !hasCustomLists;
        if (shouldLoadBundledBlocklist) {
            try {
                const content = await DomainListService.loadFile(this.BUNDLED_BLOCKLIST_PATH, 'bundled blocklist');
                for (const domain of DomainListService.processDomainList(content)) {
                    disposableDomains.add(domain);
                }
            } catch (error) {
                if (!hasCustomLists) {
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

        if (hasCustomLists) {
            for (const source of options.domainLists!) {
                const domains = await this.loadDomainListSource(source);
                const targetSet = source.type === 'allow' ? allowedDomains : disposableDomains;
                for (const domain of domains) {
                    targetSet.add(domain);
                }
            }
        }

        return new DisposableEmailChecker(disposableDomains, allowedDomains);
    }

    /**
     * Adds a domain to the allowlist, overriding the blocklist for this instance.
     * @param domain - The domain to allow (e.g., "mycompany.com").
     */
    addAllowedDomain(domain: string): void {
        domain = domain.trim();
        if (domain === '') {
            return;
        }
        this.allowedDomains.add(domain.toLowerCase());
    }

    /**
     * Adds a domain to the blocklist for this instance.
     * @param domain - The domain to block (e.g., "sketchy-domain.io").
     */
    addDisposableDomain(domain: string): void {
        domain = domain.trim();
        if (domain === '') {
            return;
        }
        this.disposableDomains.add(domain.toLowerCase());
    }

    /**
     * Checks multiple email addresses against the blocklist.
     * @returns A parallel array of booleans indicating disposability.
     */
    checkEmails(emails: string[]): boolean[] {
        return emails.map((email) => this.isDisposable(email));
    }

    /**
     * Returns true if at least one email in the list is disposable.
     */
    containsDisposable(emails: string[]): boolean {
        return emails.some((email) => this.isDisposable(email));
    }

    /** Returns the number of domains in the blocklist. */
    getDisposableDomainCount(): number {
        return this.disposableDomains.size;
    }

    /** Returns only the disposable email addresses from a list. */
    getDisposableEmails(emails: string[]): string[] {
        if (!Array.isArray(emails)) {
            return [];
        }
        return emails.filter((email) => this.isDisposable(email));
    }

    /**
     * Extracts the domain from an email address.
     * @returns The lowercase domain, or null if the email is invalid.
     */
    getDomainFromEmail(email: string): string | null {
        const match = EMAIL_REGEXP.exec(email);
        return match ? match[1].toLowerCase() : null;
    }

    /** Returns only the non-disposable email addresses from a list. */
    getNonDisposableEmails(emails: string[]): string[] {
        if (!Array.isArray(emails)) {
            return [];
        }
        return emails.filter((email) => !this.isDisposable(email));
    }

    /**
     * Checks if an email address's domain is disposable.
     * Walks up the domain hierarchy to catch subdomains of blocked domains.
     */
    isDisposable(email: string): boolean {
        const domain = this.getDomainFromEmail(email);
        if (!domain) {
            return false;
        }
        return this.isDomainBlocked(domain);
    }

    /**
     * Checks if a domain is disposable.
     * Walks up the domain hierarchy to catch subdomains of blocked domains.
     */
    isDomainDisposable(domain: string): boolean {
        if (!domain || domain.trim() === '') {
            return false;
        }
        return this.isDomainBlocked(domain.toLowerCase());
    }

    /** Validates whether a string conforms to standard email syntax. */
    isValidEmailSyntax(email: string): boolean {
        return EMAIL_REGEXP.test(email);
    }

    // region Private

    /**
     * Checks a domain against the allowlist and blocklist, walking up the
     * domain hierarchy. For example, if "example.com" is blocked,
     * "mail.example.com" will also be detected as disposable.
     *
     * The allowlist is checked at each level and takes priority.
     */
    private isDomainBlocked(domain: string): boolean {
        const parts = domain.split('.');

        for (let i = 0; i < parts.length - 1; i++) {
            const candidate = parts.slice(i).join('.');

            if (this.allowedDomains.has(candidate)) {
                return false;
            }

            if (this.disposableDomains.has(candidate)) {
                return true;
            }
        }

        return false;
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
