import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import {DisposableEmailChecker, type DisposableEmailCheckerOptions} from '../src';

const TEST_LOCAL_BLOCKLIST_PATH = path.join(__dirname, 'BLOCKLIST');
const TEST_LOCAL_ALLOWLIST_PATH = path.join(__dirname, 'ALLOWLIST');
const GITHUB_RAW_URL = 'https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/main/disposable_email_blocklist.conf';

describe('DisposableEmailChecker', () => {

    beforeAll(async () => {
        const blocklistContent = [
            'example.com',
            'testmail.org',
            'temp.net',
            'abc.xyz',
            'foo.bar',
            '# This is a comment',
            '',
            'another.com',
            'UPPERCASE.COM',
            'invalid-tld'
        ].join('\n');
        await fs.writeFile(TEST_LOCAL_BLOCKLIST_PATH, blocklistContent, 'utf8');

        const allowlistContent = [
            'example.com',
            'safe-domain.org'
        ].join('\n');
        await fs.writeFile(TEST_LOCAL_ALLOWLIST_PATH, allowlistContent, 'utf8');
    });

    afterAll(async () => {
        await fs.unlink(TEST_LOCAL_BLOCKLIST_PATH).catch(() => {});
        await fs.unlink(TEST_LOCAL_ALLOWLIST_PATH).catch(() => {});
    });

    // --- Factory / Initialization ---

    it('should create an instance with default (bundled) data', async () => {
        const checker = await DisposableEmailChecker.create();
        expect(checker).toBeInstanceOf(DisposableEmailChecker);
        expect(checker.getDisposableDomainCount()).toBeGreaterThan(0);
    });

    it('should correctly identify disposable domains using bundled data', async () => {
        const checker = await DisposableEmailChecker.create();
        expect(checker.isDisposable('test@5mail.cf')).toBe(true);
        expect(checker.isDisposable('test@yopmail.com')).toBe(true);
        expect(checker.isDisposable('test@protonmail.com')).toBe(false);
        expect(checker.isDisposable('user@gmail.com')).toBe(false);
    });

    it('should handle case-insensitive domain matching', async () => {
        const checker = await DisposableEmailChecker.create();
        expect(checker.isDisposable('test@5Mail.cf')).toBe(true);
        expect(checker.isDisposable('TEST@YOPMAIL.COM')).toBe(true);
        expect(checker.isDisposable('user@GmAiL.cOm')).toBe(false);
    });

    it('should create an instance from a local file path (block list)', async () => {
        const options: DisposableEmailCheckerOptions = {
            domainLists: [{type: 'block', filePath: TEST_LOCAL_BLOCKLIST_PATH}]
        };
        const checker = await DisposableEmailChecker.create(options);
        expect(checker).toBeInstanceOf(DisposableEmailChecker);

        expect(checker.isDisposable('user@testmail.org')).toBe(true);
        expect(checker.isDisposable('user@temp.net')).toBe(true);
        expect(checker.isDisposable('user@another.com')).toBe(true);
        expect(checker.isDisposable('user@uppercase.com')).toBe(true);
        expect(checker.isDisposable('user@nonexistent.info')).toBe(false);
    });

    it('should create an instance from a local file path with allowlist', async () => {
        const options: DisposableEmailCheckerOptions = {
            domainLists: [
                {type: 'block', filePath: TEST_LOCAL_BLOCKLIST_PATH},
                {type: 'allow', filePath: TEST_LOCAL_ALLOWLIST_PATH}
            ]
        };
        const checker = await DisposableEmailChecker.create(options);

        expect(checker.isDisposable('user@example.com')).toBe(false);
        expect(checker.isDisposable('user@testmail.org')).toBe(true);
    });

    it('should create an instance from an inline data array', async () => {
        const options: DisposableEmailCheckerOptions = {
            domainLists: [{type: 'block', list: ['custom-spam.com', 'junk.io']}]
        };
        const checker = await DisposableEmailChecker.create(options);
        expect(checker.isDisposable('user@custom-spam.com')).toBe(true);
        expect(checker.isDisposable('user@junk.io')).toBe(true);
        expect(checker.isDisposable('user@gmail.com')).toBe(false);
    });

    it('should load bundled blocklist alongside custom lists when useBundledBlocklist is true', async () => {
        const options: DisposableEmailCheckerOptions = {
            useBundledBlocklist: true,
            domainLists: [{type: 'block', list: ['my-custom-spam.com']}]
        };
        const checker = await DisposableEmailChecker.create(options);
        expect(checker.isDisposable('user@my-custom-spam.com')).toBe(true);
        expect(checker.isDisposable('test@yopmail.com')).toBe(true);
    });

    it('should throw an error if blocklist file does not exist', async () => {
        const options: DisposableEmailCheckerOptions = {
            domainLists: [{type: 'block', filePath: '/non/existent/path.txt'}]
        };
        await expect(DisposableEmailChecker.create(options)).rejects.toThrow(/Failed to load/);
    });

    it('should create an instance from a URL', async () => {
        const options: DisposableEmailCheckerOptions = {
            domainLists: [{type: 'block', url: GITHUB_RAW_URL}]
        };
        const checker = await DisposableEmailChecker.create(options);
        expect(checker).toBeInstanceOf(DisposableEmailChecker);
        expect(checker.isDisposable('test@yopmail.com')).toBe(true);
    }, 20000);

    // --- Invalid email handling ---

    it('should return false for invalid email formats', async () => {
        const checker = await DisposableEmailChecker.create();
        expect(checker.isDisposable('invalid-email')).toBe(false);
        expect(checker.isDisposable('no-at-sign.com')).toBe(false);
        expect(checker.isDisposable('')).toBe(false);
    });

    // --- Batch operations ---

    it('should check a list of emails (checkEmails)', async () => {
        const checker = await DisposableEmailChecker.create();
        const emails = [
            'test@5mail.cf',
            'user@gmail.com',
            'foo@yopmail.com',
            'another@outlook.com',
            'invalid-email-format'
        ];
        const results = checker.checkEmails(emails);
        expect(results).toEqual([true, false, true, false, false]);
    });

    it('should detect if any email is disposable (containsDisposable)', async () => {
        const checker = await DisposableEmailChecker.create();
        expect(checker.containsDisposable(['user@gmail.com', 'test@5mail.cf'])).toBe(true);
        expect(checker.containsDisposable(['user@gmail.com', 'user@outlook.com'])).toBe(false);
    });

    it('should filter disposable emails (getDisposableEmails)', async () => {
        const checker = await DisposableEmailChecker.create();
        const emails = ['user@gmail.com', 'test@5mail.cf', 'foo@yopmail.com'];
        expect(checker.getDisposableEmails(emails)).toEqual(['test@5mail.cf', 'foo@yopmail.com']);
    });

    it('should filter non-disposable emails (getNonDisposableEmails)', async () => {
        const checker = await DisposableEmailChecker.create();
        const emails = ['user@gmail.com', 'test@5mail.cf', 'foo@yopmail.com'];
        expect(checker.getNonDisposableEmails(emails)).toEqual(['user@gmail.com']);
    });

    // --- Domain-level operations ---

    it('should check a domain directly (isDomainDisposable)', async () => {
        const checker = await DisposableEmailChecker.create();
        expect(checker.isDomainDisposable('yopmail.com')).toBe(true);
        expect(checker.isDomainDisposable('gmail.com')).toBe(false);
        expect(checker.isDomainDisposable('')).toBe(false);
    });

    it('should extract domain from email (getDomainFromEmail)', async () => {
        const checker = await DisposableEmailChecker.create();
        expect(checker.getDomainFromEmail('user@gmail.com')).toBe('gmail.com');
        expect(checker.getDomainFromEmail('USER@GMAIL.COM')).toBe('gmail.com');
        expect(checker.getDomainFromEmail('invalid')).toBeNull();
    });

    it('should validate email syntax (isValidEmailSyntax)', async () => {
        const checker = await DisposableEmailChecker.create();
        expect(checker.isValidEmailSyntax('user@example.com')).toBe(true);
        expect(checker.isValidEmailSyntax('invalid')).toBe(false);
        expect(checker.isValidEmailSyntax('')).toBe(false);
        expect(checker.isValidEmailSyntax('user@domain.co.uk')).toBe(true);
    });

    // --- Runtime domain management ---

    it('should allow adding domains to the allowlist at runtime', async () => {
        const checker = await DisposableEmailChecker.create();
        expect(checker.isDisposable('test@yopmail.com')).toBe(true);

        checker.addAllowedDomain('yopmail.com');
        expect(checker.isDisposable('test@yopmail.com')).toBe(false);
    });

    it('should allow adding domains to the blocklist at runtime', async () => {
        const checker = await DisposableEmailChecker.create();
        expect(checker.isDisposable('test@my-new-spam.com')).toBe(false);

        checker.addDisposableDomain('my-new-spam.com');
        expect(checker.isDisposable('test@my-new-spam.com')).toBe(true);
    });

    it('should ignore empty strings when adding domains', async () => {
        const checker = await DisposableEmailChecker.create();
        const countBefore = checker.getDisposableDomainCount();
        checker.addDisposableDomain('');
        checker.addDisposableDomain('   ');
        expect(checker.getDisposableDomainCount()).toBe(countBefore);
    });

    // --- Subdomain matching ---

    it('should detect subdomains of blocked domains (isDisposable)', async () => {
        const checker = await DisposableEmailChecker.create({
            domainLists: [{type: 'block', list: ['spammy.com']}]
        });
        expect(checker.isDisposable('user@spammy.com')).toBe(true);
        expect(checker.isDisposable('user@mail.spammy.com')).toBe(true);
        expect(checker.isDisposable('user@sub.mail.spammy.com')).toBe(true);
        expect(checker.isDisposable('user@notspammy.com')).toBe(false);
    });

    it('should detect subdomains of blocked domains (isDomainDisposable)', async () => {
        const checker = await DisposableEmailChecker.create({
            domainLists: [{type: 'block', list: ['spammy.com']}]
        });
        expect(checker.isDomainDisposable('spammy.com')).toBe(true);
        expect(checker.isDomainDisposable('mail.spammy.com')).toBe(true);
        expect(checker.isDomainDisposable('deep.sub.spammy.com')).toBe(true);
        expect(checker.isDomainDisposable('notspammy.com')).toBe(false);
    });

    it('should respect allowlist when checking subdomains', async () => {
        const checker = await DisposableEmailChecker.create({
            domainLists: [
                {type: 'block', list: ['spammy.com']},
                {type: 'allow', list: ['legit.spammy.com']}
            ]
        });
        expect(checker.isDisposable('user@spammy.com')).toBe(true);
        expect(checker.isDisposable('user@legit.spammy.com')).toBe(false);
        expect(checker.isDisposable('user@other.spammy.com')).toBe(true);
    });

    // --- Count ---

    it('should return the blocklist size (getDisposableDomainCount)', async () => {
        const checker = await DisposableEmailChecker.create();
        expect(checker.getDisposableDomainCount()).toBeGreaterThan(1000);
    });
});
