// scripts/update-blocklist.ts
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

/**
 * Fetches the latest blocklist from an upstream source, processes it, and then
 * saves it in a format suitable for bundling with the library.
 */
export async function updateBlocklist(sourceUrl: string, outputDirectory: string, outputFileName: string = 'BLOCKLIST'): Promise<void> {
    console.log(`sourcing blocklist from: ${sourceUrl}`);
    const response = await fetch(sourceUrl);
    if (!response.ok) {
        throw new Error(`Failed to fetch blocklist from ${sourceUrl}: ${response.statusText}`);
    }
    const rawContent = await response.text();
    console.log('Blocklist fetched successfully.');

    const domains = new Set<string>();

    rawContent.split('\n').forEach(line => {
        const trimmedLine = line.trim();
        // Skip empty lines and comments (lines starting with '#')
        if (trimmedLine.length === 0 || trimmedLine.startsWith('#')) {
            return;
        }
        // Add to set, ensuring lowercase for consistent matching and uniqueness
        domains.add(trimmedLine.toLowerCase());
    });

    // Convert Set to sorted Array for consistent output in the bundled file
    const sortedDomains = Array.from(domains).sort();

    // Ensure the output directory exists
    await fs.mkdir(outputDirectory, {recursive: true});

    // Define the full output path
    const outputPath = path.join(outputDirectory, outputFileName);

    // Save as a plain text file, one domain per line.
    await fs.writeFile(outputPath, sortedDomains.join('\n'), 'utf8');

    console.log(`Blocklist updated. ${sortedDomains.length} unique domains saved to ${outputPath}`);
}

// Self-executing function to run the update
(async () => {
    const DEFAULT_SOURCE_URL = 'https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/main/disposable_email_blocklist.conf';
    const OUTPUT_DIR = path.join(__dirname, '..', 'data'); // Saves to a 'data' folder in your project root

    try {
        await updateBlocklist(DEFAULT_SOURCE_URL, OUTPUT_DIR);
        process.exit(0); // Exit successfully
    } catch (error) {
        console.error('Error updating blocklist:', error instanceof Error ? error.message : error);
        process.exit(1); // Exit with an error code
    }
})();
