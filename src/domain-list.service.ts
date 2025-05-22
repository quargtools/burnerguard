import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {DomainListResult} from './interfaces/domain-list-result.interface';
import {ListOptions} from './interfaces/list-options.interface';

export class DomainListService {
    private static instance: DomainListService;

    constructor(private readonly outputDirectory: string) {}

    public static getInstance(outputDirectory?: string) {
        if (!this.instance) {
            if (!outputDirectory) {
                outputDirectory = path.resolve(__dirname, '..', 'data');
            }

            this.instance = new DomainListService(outputDirectory);
        }

        return this.instance;
    }

    /**
     * Fetches the domain list from the provided URL.
     *
     * @param {string} url - The URL from which to fetch the domain list.
     * @return {Promise<string>} A promise that resolves to the text content of the fetched domain list.
     * @throws {Error} If the fetch request fails or the response is not OK.
     */
    public async fetchDomainList(url: string): Promise<string> {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
        }
        return response.text();
    }

    /**
     * Processes a string containing domain names, filters out duplicates, ignores comments and empty lines,
     * and returns a result containing sorted unique domains along with their count.
     *
     * @param {string} content - The input string that consists of domain names, where each domain is on a new line.
     * Lines starting with '#' are treated as comments and ignored. Empty lines are also ignored.
     * @return {DomainListResult} An object containing a sorted array of unique domain names and their total count.
     */
    public processDomainList(content: string): DomainListResult {
        const domains = new Set<string>();

        content.split('\n').forEach(line => {
            const trimmedLine = line.trim();
            if (trimmedLine.length === 0 || trimmedLine.startsWith('#')) return;
            domains.add(trimmedLine.toLowerCase());
        });

        const sortedDomains = Array.from(domains).sort();
        return {
            domains: sortedDomains,
            count: sortedDomains.length
        };
    }

    /**
     * Loads the content of a file asynchronously as a UTF-8 encoded string.
     *
     * @param {string} filePath - The path to the file that needs to be loaded.
     * @param {string} errorContext - A descriptive context of the file usage to include in error messages.
     * @return {Promise<string>} The content of the file as a UTF-8 encoded string.
     * @throws {Error} If the file cannot be loaded, an error is thrown with a context-specific message.
     */
    public async loadFile(filePath: string, errorContext: string): Promise<string> {
        try {
            return await fs.readFile(filePath, { encoding: 'utf8' });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to load ${errorContext}. ${errorMessage}`);
        }
    }

    /**
     * Writes a list of domain names to a file in the specified directory.
     *
     * @param {string} fileName - The name of the file to save the domain list.
     * @param {string[]} domains - An array of domain names to be written to the file.
     * @return {Promise<string>} A promise that resolves to the full file path of the saved file.
     */
    public async saveDomainList(fileName: string, domains: string[]): Promise<string> {
        await fs.mkdir(this.outputDirectory, { recursive: true });
        const filePath = path.join(this.outputDirectory, fileName);
        await fs.writeFile(filePath, domains.join('\n'), 'utf8');
        return filePath;
    }

    /**
     * Fetches the latest blocklist/allowlist from an upstream source, processes it,
     * and then saves it in a format suitable for bundling with the library.
     */
    public async updateLists(lists: ListOptions[]): Promise<void> {
        for (const list of lists) {
            console.log(`Sourcing ${list.listName.toLowerCase()} from: ${list.url}`);
            const content = await this.fetchDomainList(list.url);
            console.log(`${list.listName} fetched successfully.`);

            const { domains, count } = this.processDomainList(content);
            const filePath = await this.saveDomainList(list.outputPath, domains);

            console.log(`${list.listName} updated. ${count} unique domains saved to ${filePath}`);
        }
    }
}
