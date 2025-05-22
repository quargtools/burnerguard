import * as path from 'node:path';
import {ListOptions} from '../src/interfaces/list-options.interface';
import {DomainListService} from '../src/domain-list.service';

const UPSTREAM_BLOCKLIST_URL = 'https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/main/disposable_email_blocklist.conf';
const UPSTREAM_ALLOWLIST_URL = 'https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/main/allowlist.conf';

/**
 * Fetches the latest blocklist/allowlist from an upstream source, processes it,
 * and then saves it in a format suitable for bundling with the library.
 */
export async function updateBlocklist(outputDirectory: string, blocklistFileName: string = 'BLOCKLIST', allowlistFileName: string = 'ALLOWLIST'): Promise<void> {
    const domainListService = new DomainListService(outputDirectory);

    const lists: ListOptions[] = [
        {
            url: UPSTREAM_BLOCKLIST_URL,
            outputPath: blocklistFileName,
            listName: 'Blocklist'
        },
        {
            url: UPSTREAM_ALLOWLIST_URL,
            outputPath: allowlistFileName,
            listName: 'Allowlist'
        }
    ];

    await domainListService.updateLists(lists);
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
