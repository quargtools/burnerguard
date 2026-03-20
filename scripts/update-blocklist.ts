import * as path from 'node:path';

import type { ListOptions } from '../src/interfaces';
import { DomainListService } from '../src/services';

const UPSTREAM_BLOCKLIST_URL = 'https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/main/disposable_email_blocklist.conf';
const UPSTREAM_ALLOWLIST_URL = 'https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/main/allowlist.conf';

(async () => {
    const OUTPUT_DIR = path.resolve(__dirname, '..', 'data');

    const listsToUpdate: ListOptions[] = [
        {
            listName: 'Blocklist',
            url: UPSTREAM_BLOCKLIST_URL,
            outputPath: 'BLOCKLIST'
        },
        {
            listName: 'Allowlist',
            url: UPSTREAM_ALLOWLIST_URL,
            outputPath: 'ALLOWLIST'
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
