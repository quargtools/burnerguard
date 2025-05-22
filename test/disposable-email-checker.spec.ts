import { DisposableEmailChecker, DisposableEmailCheckerOptions } from '../src'; // Adjust path if needed
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

// Define paths for testing different loading mechanisms
const BUNDLED_BLOCKLIST_PATH = path.resolve(__dirname, '..', 'data', 'BLOCKLIST');
const TEST_LOCAL_BLOCKLIST_PATH = path.join(__dirname, 'BLOCKLIST');
const GITHUB_RAW_URL = 'https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/main/disposable_email_blocklist.conf';

describe('DisposableEmailChecker (Factory Pattern)', () => {

    beforeAll(async () => {
        // Create a dummy local blocklist file for filePath testing
        const dummyContent = [
            'example.com',
            'testmail.org',
            'temp.net',
            'abc.xyz',
            'foo.bar',
            '# This is a comment',
            '', // Empty line
            'another.com', // Should be included
            'UPPERCASE.COM', // Should be normalized to lowercase
            'invalid-tld'
        ].join('\n');
        await fs.writeFile(TEST_LOCAL_BLOCKLIST_PATH, dummyContent, 'utf8');
    });

    // --- Teardown after tests ---
    afterAll(async () => {
        // Clean up the dummy local blocklist file
        await fs.unlink(TEST_LOCAL_BLOCKLIST_PATH).catch(() => {});
    });

    // --- Test Cases ---

    it('should create an instance successfully with default (bundled) data', async () => {
        const checker = await DisposableEmailChecker.create();
        expect(checker).toBeInstanceOf(DisposableEmailChecker);
        // After creation, the internal Set should not be empty
        expect((checker as any).disposableDomains.size).toBeGreaterThan(0);
    });

    it('should correctly identify disposable domains using bundled data', async () => {
        const checker = await DisposableEmailChecker.create();
        // These assertions rely on the actual content of the disposable-email-domains list.
        expect(checker.isDisposable('test@5mail.cf')).toBe(true);
        expect(checker.isDisposable('test@yopmail.com')).toBe(true);
        expect(checker.isDisposable('test@protonmail.com')).toBe(false);
        expect(checker.isDisposable('user@gmail.com')).toBe(false);
    });

    it('should correctly identify domains regardless of casing (bundled data)', async () => {
        const checker = await DisposableEmailChecker.create();
        expect(checker.isDisposable('test@5Mail.cf')).toBe(true);
        expect(checker.isDisposable('TEST@YOPMAIL.COM')).toBe(true);
        expect(checker.isDisposable('user@GmAiL.cOm')).toBe(false);
    });

    it('should handle invalid email formats as non-disposable', async () => {
        const checker = await DisposableEmailChecker.create();
        expect(checker.isDisposable('invalid-email')).toBe(false);
        expect(checker.isDisposable('no-at-sign.com')).toBe(false);
        expect(checker.isDisposable('test@invalid-domain')).toBe(false);
    });

    it('should create an instance successfully from a local file path', async () => {
        const options: DisposableEmailCheckerOptions = { filePath: TEST_LOCAL_BLOCKLIST_PATH };
        const checker = await DisposableEmailChecker.create(options);
        expect(checker).toBeInstanceOf(DisposableEmailChecker);

        // Check against content of TEST_LOCAL_BLOCKLIST_PATH
        expect(checker.isDisposable('user@example.com')).toBe(true);
        expect(checker.isDisposable('user@testmail.org')).toBe(true);
        expect(checker.isDisposable('user@temp.net')).toBe(true);
        expect(checker.isDisposable('user@another.com')).toBe(true);
        expect(checker.isDisposable('user@UPPERCASE.COM')).toBe(true); // Should normalize to lowercase
        expect(checker.isDisposable('user@nonexistent.info')).toBe(false); // Not in dummy list
        expect(checker.isDisposable('user@invalid-tld')).toBe(true); // Should recognize from dummy list
    });

    // NOTE: This test requires an active internet connection.
    it('should create an instance successfully from a URL', async () => {
        const options: DisposableEmailCheckerOptions = { url: GITHUB_RAW_URL };
        const checker = await DisposableEmailChecker.create(options);
        expect(checker).toBeInstanceOf(DisposableEmailChecker);

        // After loading from URL, it should now use the GitHub content
        expect(checker.isDisposable('test@5mail.cf')).toBe(true);
        expect(checker.isDisposable('test@yopmail.com')).toBe(true);
        expect(checker.isDisposable('test@example.com')).toBe(false); // This should now be false as it's not in the real GitHub list
    }, 20000); // Increase timeout for network request

    it('should check a list of emails correctly (checkEmails)', async () => {
        const checker = await DisposableEmailChecker.create();
        const emails = [
            'test@5mail.cf',
            'user@gmail.com',
            'foo@yopmail.com',
            'another@outlook.com',
            'invalid-email-format',
        ];
        const results = checker.checkEmails(emails);

        expect(results[0]).toBe(true);
        expect(results[1]).toBe(false);
        expect(results[2]).toBe(true);
        expect(results[3]).toBe(false);
        expect(results[4]).toBe(false);
    });

    it('should return true with containsDisposable if at least one email is disposable', async () => {
        const checker = await DisposableEmailChecker.create();
        const emailsWithDisposable = [
            'user@example.com',
            'test@5mail.cf', // Disposable
            'another@gmail.com',
        ];
        expect(checker.containsDisposable(emailsWithDisposable)).toBe(true);

        const emailsWithoutDisposable = [
            'user@example.com',
            'another@gmail.com',
            'john.doe@corporate.org',
        ];
        expect(checker.containsDisposable(emailsWithoutDisposable)).toBe(false);
    });

    it('should throw an error if blocklist cannot be loaded (e.g., bad file path)', async () => {
        const options: DisposableEmailCheckerOptions = { filePath: '/non/existent/path/to/blocklist.txt' };
        await expect(DisposableEmailChecker.create(options)).rejects.toThrow(/Failed to load/);
    });
});
