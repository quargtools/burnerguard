import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import {DisposableEmailCheckerOptions} from "./disposable-email-checker-options.interface";

// Regex to extract the domain from an email address
const EMAIL_REGEXP = /^(?=.{1,254}$)(?=.{1,64}@)[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)$/;

export class DisposableEmailChecker {
    private disposableDomains: Set<string>;

    /**
     * Private constructor to ensure instances are only created via the static async create method.
     * @param domains - The Set of disposable domains.
     */
    private constructor(domains: Set<string>) {
        this.disposableDomains = domains;
    }

    /**
     * Asynchronously creates and initializes a DisposableEmailChecker instance.
     * This is the recommended way to get a fully ready checker.
     * @param options - Configuration for loading the blocklist.
     * @returns A Promise that resolves to a fully initialized DisposableEmailChecker instance.
     */
    public static async create(options?: DisposableEmailCheckerOptions): Promise<DisposableEmailChecker> {
        let rawContent: string;

        if (options?.filePath) {
            console.log(`Loading blocklist from local file: ${options.filePath}`);
            try {
            rawContent = await fs.readFile(options.filePath, { encoding: 'utf8' });
            } catch (error) {
                console.error(`Error loading bundled blocklist: ${error instanceof Error ? error.message : String(error)}`);
                throw new Error(`Failed to load default disposable domains blocklist. Make sure 'npm run update-blocklist' was run and the file is included in package.json 'files' array. Original error: ${error instanceof Error ? error.message : String(error)}`);
            }
        } else if (options?.url) {
            console.log(`Loading blocklist from URL: ${options.url}`);
            const response = await fetch(options.url);
            if (!response.ok) {
                throw new Error(`Failed to fetch blocklist from ${options.url}: ${response.statusText}`);
            }
            rawContent = await response.text();
        } else {
            // Default: Load from bundled list (generated at build time)
            const bundledFilePath = path.resolve(__dirname, '..', 'data', 'BLOCKLIST');
            console.log(`Loading bundled blocklist from: ${bundledFilePath}`);
            try {
                rawContent = await fs.readFile(bundledFilePath, { encoding: 'utf8' });
            } catch (error) {
                console.error(`Error loading bundled blocklist: ${error instanceof Error ? error.message : String(error)}`);
                throw new Error(`Failed to load default disposable domains blocklist. Make sure 'npm run update-blocklist' was run and the file is included in package.json 'files' array. Original error: ${error instanceof Error ? error.message : String(error)}`);
            }
        }

        const domains = DisposableEmailChecker.parseBlocklistContent(rawContent);
        console.log(`Blocklist loaded with ${domains.size} domains.`);
        return new DisposableEmailChecker(domains);
    }

    /**
     * Parses the raw blocklist content into a Set of lowercase domains.
     * Made static as it's part of the creation process and doesn't depend on an instance.
     * @param content - The raw string content of the blocklist file.
     * @returns A Set of disposable domains.
     */
    private static parseBlocklistContent(content: string): Set<string> {
        const domains = new Set<string>();
        content.split('\n').forEach(line => {
            const trimmedLine = line.trim();
            if (trimmedLine.length === 0 || trimmedLine.startsWith('#')) {
                return; // Skip empty lines and comments
            }
            domains.add(trimmedLine.toLowerCase()); // Ensure lowercase for case-insensitive matching
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
        return match ? match[1].toLowerCase() : null; // Convert to lowercase for consistent matching
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
            // Treat invalid email formats as non-disposable by default for a blocklist.
            return false;
        }
        return this.disposableDomains.has(domain);
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
