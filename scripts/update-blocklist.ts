// scripts/update-blocklist.ts
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const UPSTREAM_BLOCKLIST_URL = 'https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/main/disposable_email_blocklist.conf';
const UPSTREAM_ALLOWLIST_URL = 'https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/main/allowlist.conf';

/**
 * Fetches the latest blocklist/allowlist from an upstream source, processes it,
 * and then  saves it in a format suitable for bundling with the library.
 */
export async function updateBlocklist(outputDirectory: string, blocklistFileName: string = 'BLOCKLIST', allowlistFileName: string = 'ALLOWLIST'): Promise<void> {
    console.log(`Sourcing blocklist from: ${UPSTREAM_BLOCKLIST_URL}`);
    const blocklistResponse = await fetch(UPSTREAM_BLOCKLIST_URL);
    if (!blocklistResponse.ok) {
        throw new Error(`Failed to fetch blocklist: ${blocklistResponse.statusText}`);
    }
    const rawBlocklistContent = await blocklistResponse.text();
    console.log('Blocklist fetched successfully.');

    console.log(`Sourcing allowlist from: ${UPSTREAM_ALLOWLIST_URL}`);
    const allowlistResponse = await fetch(UPSTREAM_ALLOWLIST_URL);
    if (!allowlistResponse.ok) {
        throw new Error(`Failed to fetch allowlist: ${allowlistResponse.statusText}.`);
    }

    const rawAllowlistContent = await allowlistResponse.text();
    console.log('Allowlist fetched successfully.');

    const disposableDomains = new Set<string>();
    rawBlocklistContent.split('\n').forEach(line => {
        const trimmedLine = line.trim();
        if (trimmedLine.length === 0 || trimmedLine.startsWith('#')) return;
        disposableDomains.add(trimmedLine.toLowerCase());
    });
    const sortedDisposableDomains = Array.from(disposableDomains).sort();

    const allowedDomains = new Set<string>();
    rawAllowlistContent.split('\n').forEach(line => {
        const trimmedLine = line.trim();
        if (trimmedLine.length === 0 || trimmedLine.startsWith('#')) return;
        allowedDomains.add(trimmedLine.toLowerCase());
    });
    const sortedAllowedDomains = Array.from(allowedDomains).sort();

    // Ensure the output directory exists
    await fs.mkdir(outputDirectory, {recursive: true});

    // Save blocklist
    const blocklistPath = path.join(outputDirectory, blocklistFileName);
    await fs.writeFile(blocklistPath, sortedDisposableDomains.join('\n'), 'utf8');
    console.log(`Blocklist updated. ${sortedDisposableDomains.length} unique domains saved to ${blocklistPath}`);

    // Save allowlist
    const allowlistPath = path.join(outputDirectory, allowlistFileName);
    await fs.writeFile(allowlistPath, sortedAllowedDomains.join('\n'), 'utf8');
    console.log(`Allowlist updated. ${sortedAllowedDomains.length} unique domains saved to ${allowlistPath}`);
}

// Self-executing function to run the update
(async () => {
    const OUTPUT_DIR = path.join(__dirname, '..', 'data'); // Saves to a 'data' folder in your project root

    try {
        await updateBlocklist(OUTPUT_DIR);
        process.exit(0); // Exit successfully
    } catch (error) {
        console.error('Error updating blocklist/allowlist:', error instanceof Error ? error.message : error);
        process.exit(1); // Exit with an error code
    }
})()
