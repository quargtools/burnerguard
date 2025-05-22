import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import {DisposableEmailCheckerOptions} from "./disposable-email-checker-options.interface";

// Regex to extract the domain from an email address
const EMAIL_REGEXP = /^(?=.{1,254}$)(?=.{1,64}@)[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)$/;

export class DisposableEmailChecker {
    private static readonly BUNDLED_BLOCKLIST_PATH = path.resolve(__dirname, '..', 'data', 'BLOCKLIST');

    private domains: Set<string>;

    /**
     * Private constructor to ensure instances are only created via the static async create method.
     * @param domains - The Set of disposable domains.
     */
    private constructor(domains: Set<string>) {
        this.domains = domains;
    }

    /**
     * Asynchronously creates and initializes a DisposableEmailChecker instance.
     * This is the recommended way to get a fully ready checker.
     * @param options - Configuration for loading the blocklist.
     * @returns A Promise that resolves to a fully initialized DisposableEmailChecker instance.
     */
    public static async create(options?: DisposableEmailCheckerOptions): Promise<DisposableEmailChecker> {
        const { content, source } = await this.loadContent(options);
        console.log(`Loading blocklist from: ${source}`);

        const domains = this.parseDomains(content);
        console.log(`Blocklist loaded with ${domains.size} domains.`);

        return new DisposableEmailChecker(domains);
    }

    private static async loadContent(options?: DisposableEmailCheckerOptions): Promise<BlocklistLoadResult> {
        if (options?.filePath) {
            const content = await this.loadFile(options.filePath, 'custom blocklist');
            return { content, source: options.filePath };
        }

        if (options?.url) {
            const response = await fetch(options.url);
            if (!response.ok) {
                throw new Error(`Failed to fetch blocklist from ${options.url}: ${response.statusText}`);
            }
            const content = await response.text();
            return { content, source: options.url };
        }

        const content = await this.loadFile(this.BUNDLED_BLOCKLIST_PATH, 'bundled blocklist');
        return { content, source: this.BUNDLED_BLOCKLIST_PATH };
    }



    /**
     * Loads the content of a file asynchronously as a UTF-8 encoded string.
     *
     * @param {string} filePath - The path to the file that needs to be loaded.
     * @param {string} errorContext - A descriptive context of the file usage to include in error messages.
     * @return {Promise<string>} The content of the file as a UTF-8 encoded string.
     * @throws {Error} If the file cannot be loaded, an error is thrown with a context-specific message.
     */
    private static async loadFile(filePath: string, errorContext: string): Promise<string> {
        try {
            return await fs.readFile(filePath, { encoding: 'utf8' });
        } catch (error) {
            console.error(`Error loading ${errorContext}: ${error instanceof Error ? error.message : String(error)}`);
            throw new Error(`Failed to load ${errorContext}. Make sure 'npm run update-blocklist' was run and the file is included in package.json 'files' array. Original error: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Parses the raw blocklist content into a Set of lowercase domains.
     * Made static as it's part of the creation process and doesn't depend on an instance.
     * @param content - The raw string content of the blocklist file.
     * @returns A Set of disposable domains.
     */
    private static parseDomains(content: string): Set<string> {
        const domains = new Set<string>();
        content.split('\n').forEach(line => {
            const trimmedLine = line.trim();
            if (trimmedLine.length === 0 || trimmedLine.startsWith('#')) {
                return;
            }
            domains.add(trimmedLine.toLowerCase());
        });
        return domains;
    }

    /**
     * Extracts the domain from an email address.
     * @param email - The email address.
     * @returns The domain string or null if not a valid email format.
     */
    private getDomainFromEmail(email: string): string | null {
        const match = EMAIL_REGEXP.exec(email);
        return match ? match[1].toLowerCase() : null;
    }

    /**
     * Checks if a single email address's domain is in the disposable list.
     * This method is now SYNCHRONOUS, as the instance is guaranteed to be initialized.
     * @param email - The email address to check.
     * @returns true if the domain is disposable, false otherwise.
     */
    public isDisposable(email: string): boolean {
        const domain = this.getDomainFromEmail(email);
        return domain ? this.domains.has(domain) : false;
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
}

interface BlocklistLoadResult {
    content: string;
    source: string;
}

