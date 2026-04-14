import * as path from 'node:path';

import {DomainListService} from '../src/services';

interface ListOptions {
    url: string;
    outputPath: string;
    listName: string;
}

const UPSTREAM_BLOCKLIST_URL = 'https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/main/disposable_email_blocklist.conf';

(async () => {
    const OUTPUT_DIR = path.resolve(__dirname, '..', 'data');

    const listsToUpdate: ListOptions[] = [
        {
            listName: 'Blocklist',
            url: UPSTREAM_BLOCKLIST_URL,
            outputPath: 'BLOCKLIST'
        }
    ];

    try {
        await DomainListService.updateLists(OUTPUT_DIR, listsToUpdate);
        process.exit(0);
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error updating blocklist/allowlist:', error instanceof Error ? error.message : error);
        process.exit(1);
    }
})();
