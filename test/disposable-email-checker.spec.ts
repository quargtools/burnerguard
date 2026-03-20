import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import {EmailChecker, type EmailCheckerOptions} from '../src';

const TEST_LOCAL_BLOCKLIST_PATH = path.join(__dirname, 'BLOCKLIST');
const TEST_LOCAL_ALLOWLIST_PATH = path.join(__dirname, 'ALLOWLIST');
const GITHUB_RAW_URL = 'https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/main/disposable_email_blocklist.conf';

describe('EmailChecker', () => {

    beforeAll(async () => {
        const blocklistContent = [
            'example.com',
            'testmail.org',
            'temp.net',
            '# This is a comment',
            '',
            'another.com',
            'UPPERCASE.COM'
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
        const checker = await EmailChecker.create();
        expect(checker).toBeInstanceOf(EmailChecker);
        expect(checker.blocklistSize).toBeGreaterThan(0);
    });

    it('should create an instance from a local file path (block list)', async () => {
        const checker = await EmailChecker.create({
            sources: [{type: 'block', filePath: TEST_LOCAL_BLOCKLIST_PATH}]
        });
        expect(checker).toBeInstanceOf(EmailChecker);
        expect(checker.isDisposable('user@testmail.org')).toBe(true);
        expect(checker.isDisposable('user@nonexistent.info')).toBe(false);
    });

    it('should create an instance from a local file with allowlist', async () => {
        const checker = await EmailChecker.create({
            sources: [
                {type: 'block', filePath: TEST_LOCAL_BLOCKLIST_PATH},
                {type: 'allow', filePath: TEST_LOCAL_ALLOWLIST_PATH}
            ]
        });
        expect(checker.isDisposable('user@example.com')).toBe(false);
        expect(checker.isDisposable('user@testmail.org')).toBe(true);
    });

    it('should create an instance from an inline data array', async () => {
        const checker = await EmailChecker.create({
            sources: [{type: 'block', list: ['custom-spam.com', 'junk.io']}]
        });
        expect(checker.isDisposable('user@custom-spam.com')).toBe(true);
        expect(checker.isDisposable('user@junk.io')).toBe(true);
        expect(checker.isDisposable('user@gmail.com')).toBe(false);
    });

    it('should apply additionalBlockedDomains shorthand', async () => {
        const checker = await EmailChecker.create({
            additionalBlockedDomains: ['my-custom-spam.com']
        });
        expect(checker.isDisposable('user@my-custom-spam.com')).toBe(true);
        expect(checker.isDisposable('test@yopmail.com')).toBe(true);
    });

    it('should apply additionalAllowedDomains shorthand', async () => {
        const checker = await EmailChecker.create({
            additionalAllowedDomains: ['yopmail.com']
        });
        expect(checker.isDisposable('test@yopmail.com')).toBe(false);
    });

    it('should load bundled blocklist alongside custom sources when useBundledBlocklist is true', async () => {
        const checker = await EmailChecker.create({
            useBundledBlocklist: true,
            sources: [{type: 'block', list: ['my-custom-spam.com']}]
        });
        expect(checker.isDisposable('user@my-custom-spam.com')).toBe(true);
        expect(checker.isDisposable('test@yopmail.com')).toBe(true);
    });

    it('should throw an error if a source file does not exist', async () => {
        const options: EmailCheckerOptions = {
            sources: [{type: 'block', filePath: '/non/existent/path.txt'}]
        };
        await expect(EmailChecker.create(options)).rejects.toThrow(/Failed to load/);
    });

    it('should create an instance from a URL', async () => {
        const checker = await EmailChecker.create({
            sources: [{type: 'block', url: GITHUB_RAW_URL}]
        });
        expect(checker).toBeInstanceOf(EmailChecker);
        expect(checker.isDisposable('test@yopmail.com')).toBe(true);
    }, 20000);

    // --- isDisposable ---

    it('should identify disposable emails using bundled data', async () => {
        const checker = await EmailChecker.create();
        expect(checker.isDisposable('test@5mail.cf')).toBe(true);
        expect(checker.isDisposable('test@yopmail.com')).toBe(true);
        expect(checker.isDisposable('test@protonmail.com')).toBe(false);
        expect(checker.isDisposable('user@gmail.com')).toBe(false);
    });

    it('should handle case-insensitive domain matching', async () => {
        const checker = await EmailChecker.create();
        expect(checker.isDisposable('test@5Mail.cf')).toBe(true);
        expect(checker.isDisposable('TEST@YOPMAIL.COM')).toBe(true);
        expect(checker.isDisposable('user@GmAiL.cOm')).toBe(false);
    });

    it('should accept bare domains as well as emails', async () => {
        const checker = await EmailChecker.create();
        expect(checker.isDisposable('yopmail.com')).toBe(true);
        expect(checker.isDisposable('gmail.com')).toBe(false);
        expect(checker.isDisposable('YOPMAIL.COM')).toBe(true);
    });

    it('should return false for invalid or empty input', async () => {
        const checker = await EmailChecker.create();
        expect(checker.isDisposable('invalid-email')).toBe(false);
        expect(checker.isDisposable('')).toBe(false);
    });

    // --- check (detailed) ---

    it('should return detailed result for a disposable email', async () => {
        const checker = await EmailChecker.create();
        const result = checker.check('user@yopmail.com');
        expect(result.isDisposable).toBe(true);
        expect(result.domain).toBe('yopmail.com');
        expect(result.matchedRule).toBe('yopmail.com');
        expect(result.isAllowlisted).toBe(false);
    });

    it('should return detailed result for a clean email', async () => {
        const checker = await EmailChecker.create();
        const result = checker.check('user@gmail.com');
        expect(result.isDisposable).toBe(false);
        expect(result.domain).toBe('gmail.com');
        expect(result.matchedRule).toBeNull();
        expect(result.isAllowlisted).toBe(false);
    });

    it('should return detailed result for an allowlisted domain', async () => {
        const checker = await EmailChecker.create({
            additionalAllowedDomains: ['yopmail.com']
        });
        const result = checker.check('user@yopmail.com');
        expect(result.isDisposable).toBe(false);
        expect(result.domain).toBe('yopmail.com');
        expect(result.matchedRule).toBeNull();
        expect(result.isAllowlisted).toBe(true);
    });

    it('should return detailed result showing matched rule for subdomains', async () => {
        const checker = await EmailChecker.create({
            sources: [{type: 'block', list: ['spammy.com']}]
        });
        const result = checker.check('user@mail.spammy.com');
        expect(result.isDisposable).toBe(true);
        expect(result.domain).toBe('mail.spammy.com');
        expect(result.matchedRule).toBe('spammy.com');
    });

    it('should return null domain for invalid input', async () => {
        const checker = await EmailChecker.create();
        const result = checker.check('');
        expect(result.isDisposable).toBe(false);
        expect(result.domain).toBeNull();
    });

    // --- filter ---

    it('should split emails into disposable and clean', async () => {
        const checker = await EmailChecker.create();
        const emails = ['user@gmail.com', 'test@5mail.cf', 'foo@yopmail.com'];
        const result = checker.filter(emails);
        expect(result.disposable).toEqual(['test@5mail.cf', 'foo@yopmail.com']);
        expect(result.clean).toEqual(['user@gmail.com']);
    });

    it('should return empty arrays for empty input', async () => {
        const checker = await EmailChecker.create();
        const result = checker.filter([]);
        expect(result.disposable).toEqual([]);
        expect(result.clean).toEqual([]);
    });

    // --- hasDisposable ---

    it('should return true if any email is disposable', async () => {
        const checker = await EmailChecker.create();
        expect(checker.hasDisposable(['user@gmail.com', 'test@5mail.cf'])).toBe(true);
        expect(checker.hasDisposable(['user@gmail.com', 'user@outlook.com'])).toBe(false);
    });

    // --- block / allow ---

    it('should block a domain at runtime', async () => {
        const checker = await EmailChecker.create();
        expect(checker.isDisposable('test@my-new-spam.com')).toBe(false);
        checker.block('my-new-spam.com');
        expect(checker.isDisposable('test@my-new-spam.com')).toBe(true);
    });

    it('should allow a domain at runtime, overriding the blocklist', async () => {
        const checker = await EmailChecker.create();
        expect(checker.isDisposable('test@yopmail.com')).toBe(true);
        checker.allow('yopmail.com');
        expect(checker.isDisposable('test@yopmail.com')).toBe(false);
    });

    it('should ignore empty strings when blocking or allowing', async () => {
        const checker = await EmailChecker.create();
        const sizeBefore = checker.blocklistSize;
        checker.block('');
        checker.block('   ');
        expect(checker.blocklistSize).toBe(sizeBefore);
    });

    // --- Subdomain matching ---

    it('should detect subdomains of blocked domains', async () => {
        const checker = await EmailChecker.create({
            sources: [{type: 'block', list: ['spammy.com']}]
        });
        expect(checker.isDisposable('user@spammy.com')).toBe(true);
        expect(checker.isDisposable('user@mail.spammy.com')).toBe(true);
        expect(checker.isDisposable('user@sub.mail.spammy.com')).toBe(true);
        expect(checker.isDisposable('user@notspammy.com')).toBe(false);
    });

    it('should detect subdomains with bare domain input', async () => {
        const checker = await EmailChecker.create({
            sources: [{type: 'block', list: ['spammy.com']}]
        });
        expect(checker.isDisposable('spammy.com')).toBe(true);
        expect(checker.isDisposable('mail.spammy.com')).toBe(true);
        expect(checker.isDisposable('deep.sub.spammy.com')).toBe(true);
    });

    it('should respect allowlist when checking subdomains', async () => {
        const checker = await EmailChecker.create({
            sources: [
                {type: 'block', list: ['spammy.com']},
                {type: 'allow', list: ['legit.spammy.com']}
            ]
        });
        expect(checker.isDisposable('user@spammy.com')).toBe(true);
        expect(checker.isDisposable('user@legit.spammy.com')).toBe(false);
        expect(checker.isDisposable('user@other.spammy.com')).toBe(true);
    });

    // --- Utilities ---

    it('should extract domain from email', async () => {
        const checker = await EmailChecker.create();
        expect(checker.extractDomain('user@gmail.com')).toBe('gmail.com');
        expect(checker.extractDomain('USER@GMAIL.COM')).toBe('gmail.com');
        expect(checker.extractDomain('invalid')).toBeNull();
    });

    it('should validate email syntax', async () => {
        const checker = await EmailChecker.create();
        expect(checker.isValidEmail('user@example.com')).toBe(true);
        expect(checker.isValidEmail('user@domain.co.uk')).toBe(true);
        expect(checker.isValidEmail('invalid')).toBe(false);
        expect(checker.isValidEmail('')).toBe(false);
    });

    // --- Properties ---

    it('should expose blocklistSize and allowlistSize', async () => {
        const checker = await EmailChecker.create({useBundledAllowlist: true});
        expect(checker.blocklistSize).toBeGreaterThan(1000);
        expect(checker.allowlistSize).toBeGreaterThan(0);
    });
});
