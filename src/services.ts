import * as fs from 'node:fs/promises';
import * as path from 'node:path';

interface ListOptions {
    url: string;
    outputPath: string;
    listName: string;
}

export class DomainListService {
    /**
     * Fetches a domain list from the given URL.
     * @throws Error if the request fails.
     */
    static async fetchDomainList(url: string): Promise<string> {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
        }
        return response.text();
    }

    /**
     * Reads a file as UTF-8 text.
     * @param filePath - Absolute or relative path to the file.
     * @param errorContext - Label used in error messages (e.g., "bundled blocklist").
     * @throws Error if the file cannot be read.
     */
    static async loadFile(filePath: string, errorContext: string): Promise<string> {
        try {
            return await fs.readFile(filePath, {encoding: 'utf8'});
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to load ${errorContext}. ${message}`);
        }
    }

    /**
     * Parses a newline-delimited domain list, removing comments, blank lines,
     * and duplicates. Returns sorted, lowercase, unique domains.
     */
    static processDomainList(content: string): string[] {
        const domains = new Set<string>();

        for (const line of content.split('\n')) {
            const trimmedLine = line.trim();
            if (trimmedLine.length === 0 || trimmedLine.startsWith('#')) {
                continue;
            }
            domains.add(trimmedLine.toLowerCase());
        }

        return Array.from(domains).sort();
    }

    /**
     * Writes a list of domains to a file in the given directory.
     * @returns The absolute path of the saved file.
     */
    static async saveDomainList(outputDirectory: string, fileName: string, domains: string[]): Promise<string> {
        await fs.mkdir(outputDirectory, {recursive: true});
        const filePath = path.join(outputDirectory, fileName);
        await fs.writeFile(filePath, domains.join('\n'), 'utf8');
        return filePath;
    }

    /**
     * Fetches, processes, and saves each list in the provided array.
     * Used by the update-blocklist script.
     */
    static async updateLists(outputDirectory: string, lists: ListOptions[]): Promise<void> {
        for (const list of lists) {
            const content = await this.fetchDomainList(list.url);
            const domains = this.processDomainList(content);
            const filePath = await this.saveDomainList(outputDirectory, list.outputPath, domains);
            // eslint-disable-next-line no-console
            console.log(`${list.listName} updated. ${domains.length} unique domains saved to ${filePath}`);
        }
    }
}
