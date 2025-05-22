import * as path from 'node:path';

import {DisposableEmailCheckerOptions} from "./interfaces/disposable-email-checker-options.interface";
import {DomainListService} from './domain-list.service';

// Regex to extract the domain from an email address
const EMAIL_REGEXP = /^(?=.{1,254}$)(?=.{1,64}@)[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)$/;

export class DisposableEmailChecker {
    private static readonly BUNDLED_BLOCKLIST_PATH = path.resolve(__dirname, '..', 'data', 'BLOCKLIST');

    private readonly domainListService: DomainListService;

    /**
     * Private constructor to ensure instances are only created via the static async create method.
     * @param disposableDomains - The Set of disposable domains.
     * @param allowedDomains - The Set of allowed domains.
     */
    private constructor(private disposableDomains: Set<string>, private allowedDomains: Set<string> = new Set()) {
        this.domainListService = new DomainListService(path.dirname(DisposableEmailChecker.BUNDLED_BLOCKLIST_PATH));
    }

    /**
     * Asynchronously creates and initializes a DisposableEmailChecker instance.
     * This is the recommended way to get a fully ready checker.
     * @param options - Configuration for loading the blocklist.
     * @returns A Promise that resolves to a fully initialized DisposableEmailChecker instance.
     */
    public static async create(options?: DisposableEmailCheckerOptions): Promise<DisposableEmailChecker> {
        let { content, source } = await this.loadContent(options);
        console.log(`Loading blocklist from: ${source}`);

        const disposableDomains = DomainListService.getInstance().processDomainList(content);
        console.log(`Blocklist loaded with ${disposableDomains.count} domains.`);

        let allowList: Set<string>| undefined;
        if (options?.useUpstreamAllowlist) {
            let {content, source} = await this.loadContent(options);
            console.log(`Loading blocklist from: ${source}`);

            const domains = DomainListService.getInstance().processDomainList(content);
            console.log(`Allowlist loaded with ${domains.count} domains.`);

            allowList = new Set(domains.domains);
        }

        return new DisposableEmailChecker(new Set(disposableDomains.domains), allowList);
    }

    private static async loadContent(options?: DisposableEmailCheckerOptions): Promise<BlocklistLoadResult> {
        const domainListService = DomainListService.getInstance();

        if (options?.filePath) {
            const content = await domainListService.loadFile(options.filePath, 'custom list');
            return { content, source: options.filePath };
        }

        if (options?.url) {
            const content = await domainListService.fetchDomainList(options.url);
            return { content, source: options.url };
        }

        const content = await domainListService.loadFile(this.BUNDLED_BLOCKLIST_PATH, 'bundled list');
        return { content, source: this.BUNDLED_BLOCKLIST_PATH };
    }

    /**
     * Explicitly marks a domain as allowed, overriding the disposable blocklist for this instance.
     * The domain will be converted to lowercase for consistent matching.
     * @param domain - The domain to add to the allowlist (e.g., "mycompany.com").
     */
    public addAllowedDomain(domain: string): void {
        domain = domain.trim();
        if (domain === '') {
            console.warn('Attempted to add an invalid domain to allowlist:', domain);
            return;
        }
        this.allowedDomains.add(domain.toLowerCase());
    }

    public addDisposableDomain(domain: string): void {
        domain = domain.trim();
        if (domain === '') {
            console.warn('Attempted to add an invalid domain to disposable list:', domain);
            return;
        }
        this.disposableDomains.add(domain.toLowerCase());
    }

    /**
     * Checks a list of email addresses.
     * This method is now SYNCHRONOUS.
     * @param emails - An array of email addresses to check.
     * @returns An array of booleans, where each boolean corresponds to
     * whether the respective email's domain is disposable.
     */
    public checkEmails(emails: string[]): boolean[] {
        return emails.map(email => this.isDisposable(email));
    }

    /**
     * Checks if any of the given emails are disposable.
     * Returns true if at least one is disposable, false otherwise.
     * This method is now SYNCHRONOUS.
     * @param emails - An array of email addresses to check.
     */
    public containsDisposable(emails: string[]): boolean {
        return emails.some(email => this.isDisposable(email));
    }

    /**
     * Filters out disposable email addresses from a list of emails.
     *
     * @param {string[]} emails - The array of email addresses to be filtered.
     * @return {string[]} An array of non-disposable email addresses.
     */
    public getDisposableEmails(emails: string[]): string[] {
        if (!Array.isArray(emails)) {
            return [];
        }
        return emails.filter(email => this.isDisposable(email));
    }

    /**
     * Retrieves the count of disposable domains.
     *
     * @return {number} The number of disposable domains.
     */
    public getDomainDisposableDomainCount(): number {
        return this.disposableDomains.size;
    }

    /**
     * Extracts the domain from an email address.
     * @param email - The email address.
     * @returns The domain string or null if not a valid email format.
     */
    public getDomainFromEmail(email: string): string | null {
        const match = EMAIL_REGEXP.exec(email);
        return match ? match[1].toLowerCase() : null;
    }

    /**
     * Filters the provided array of email addresses to exclude disposable email addresses.
     *
     * @param {string[]} emails - An array of email addresses to be filtered.
     * @return {string[]} A new array containing only non-disposable email addresses.
     */
    public getNonDisposableEmails(emails: string[]): string[] {
        if (!Array.isArray(emails)) {
            return [];
        }
        return emails.filter(email => !this.isDisposable(email));
    }

    /**
     * Checks if a single email address's domain is in the disposable list.
     * This method is now SYNCHRONOUS, as the instance is guaranteed to be initialized.
     * @param email - The email address to check.
     * @returns true if the domain is disposable, false otherwise.
     */
    public isDisposable(email: string): boolean {
        const domain = this.getDomainFromEmail(email);
        if (!domain) {
            return false;
        }

        // Check against the explicit allowlist FIRST
        // Then, check against the main disposable domains blocklist
        return !this.allowedDomains.has(domain) ? this.disposableDomains.has(domain) : false;
    }

    /**
     * Determines whether a given domain is disposable.
     *
     * @param {string} domain - The domain name to be checked for disposability.
     * @return {boolean} Returns true if the domain is disposable, otherwise false.
     */
    public isDomainDisposable(domain: string): boolean {
        if (!domain || domain.trim() === '') {
            return false;
        }
        return this.disposableDomains.has(domain.toLowerCase());
    }

    /**
     * Validates whether the provided email string conforms to a standard email syntax.
     *
     * @param email The email address string to be validated.
     * @return Returns true if the email string matches the expected syntax, otherwise false.
     */
    public isValidEmailSyntax(email: string): boolean {
        return EMAIL_REGEXP.test(email);
    }
}

interface BlocklistLoadResult {
    content: string;
    source: string;
}

