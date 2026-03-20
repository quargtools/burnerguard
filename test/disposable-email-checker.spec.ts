import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import {BurnerGuard, type BurnerGuardOptions} from '../src';

const TEST_LOCAL_BLOCKLIST_PATH = path.join(__dirname, 'BLOCKLIST');
const TEST_LOCAL_ALLOWLIST_PATH = path.join(__dirname, 'ALLOWLIST');
const GITHUB_RAW_URL = 'https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/main/disposable_email_blocklist.conf';

describe('BurnerGuard', () => {

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
        const guard = await BurnerGuard.create();
        expect(guard).toBeInstanceOf(BurnerGuard);
        expect(guard.blocklistSize).toBeGreaterThan(0);
    });

    it('should create an instance from a local file path (block list)', async () => {
        const guard = await BurnerGuard.create({
            sources: [{type: 'block', filePath: TEST_LOCAL_BLOCKLIST_PATH}]
        });
        expect(guard).toBeInstanceOf(BurnerGuard);
        const result = await guard.verify('user@testmail.org');
        expect(result.isMatch).toBe(true);
        const result2 = await guard.verify('user@nonexistent.info');
        expect(result2.isMatch).toBe(false);
    });

    it('should create an instance from a local file with allowlist', async () => {
        const guard = await BurnerGuard.create({
            sources: [
                {type: 'block', filePath: TEST_LOCAL_BLOCKLIST_PATH},
                {type: 'allow', filePath: TEST_LOCAL_ALLOWLIST_PATH}
            ]
        });
        expect((await guard.verify('user@example.com')).isMatch).toBe(false);
        expect((await guard.verify('user@testmail.org')).isMatch).toBe(true);
    });

    it('should create an instance from an inline data array', async () => {
        const guard = await BurnerGuard.create({
            sources: [{type: 'block', list: ['custom-spam.com', 'junk.io']}]
        });
        expect((await guard.verify('user@custom-spam.com')).isMatch).toBe(true);
        expect((await guard.verify('user@junk.io')).isMatch).toBe(true);
        expect((await guard.verify('user@gmail.com')).isMatch).toBe(false);
    });

    it('should apply additionalBlockedDomains shorthand', async () => {
        const guard = await BurnerGuard.create({
            additionalBlockedDomains: ['my-custom-spam.com']
        });
        expect((await guard.verify('user@my-custom-spam.com')).isMatch).toBe(true);
        expect((await guard.verify('test@yopmail.com')).isMatch).toBe(true);
    });

    it('should apply additionalAllowedDomains shorthand', async () => {
        const guard = await BurnerGuard.create({
            additionalAllowedDomains: ['yopmail.com']
        });
        expect((await guard.verify('test@yopmail.com')).isMatch).toBe(false);
    });

    it('should load bundled blocklist alongside custom sources when useBundledBlocklist is true', async () => {
        const guard = await BurnerGuard.create({
            useBundledBlocklist: true,
            sources: [{type: 'block', list: ['my-custom-spam.com']}]
        });
        expect((await guard.verify('user@my-custom-spam.com')).isMatch).toBe(true);
        expect((await guard.verify('test@yopmail.com')).isMatch).toBe(true);
    });

    it('should throw an error if a source file does not exist', async () => {
        const options: BurnerGuardOptions = {
            sources: [{type: 'block', filePath: '/non/existent/path.txt'}]
        };
        await expect(BurnerGuard.create(options)).rejects.toThrow(/Failed to load/);
    });

    it('should create an instance from a URL', async () => {
        const guard = await BurnerGuard.create({
            sources: [{type: 'block', url: GITHUB_RAW_URL}]
        });
        expect(guard).toBeInstanceOf(BurnerGuard);
        expect((await guard.verify('test@yopmail.com')).isMatch).toBe(true);
    }, 20000);

    it('should accept an apiKey option', async () => {
        const guard = await BurnerGuard.create({apiKey: 'bg_test_abc123'});
        expect(guard).toBeInstanceOf(BurnerGuard);
    });

    it('should accept a threshold option', async () => {
        const guard = await BurnerGuard.create({threshold: 0.7});
        expect(guard).toBeInstanceOf(BurnerGuard);
    });

    // --- verify ---

    it('should detect matches using bundled data', async () => {
        const guard = await BurnerGuard.create();
        expect((await guard.verify('test@5mail.cf')).isMatch).toBe(true);
        expect((await guard.verify('test@yopmail.com')).isMatch).toBe(true);
        expect((await guard.verify('test@protonmail.com')).isMatch).toBe(false);
        expect((await guard.verify('user@gmail.com')).isMatch).toBe(false);
    });

    it('should handle case-insensitive domain matching', async () => {
        const guard = await BurnerGuard.create();
        expect((await guard.verify('test@5Mail.cf')).isMatch).toBe(true);
        expect((await guard.verify('TEST@YOPMAIL.COM')).isMatch).toBe(true);
        expect((await guard.verify('user@GmAiL.cOm')).isMatch).toBe(false);
    });

    it('should accept bare domains as well as emails', async () => {
        const guard = await BurnerGuard.create();
        expect((await guard.verify('yopmail.com')).isMatch).toBe(true);
        expect((await guard.verify('gmail.com')).isMatch).toBe(false);
        expect((await guard.verify('YOPMAIL.COM')).isMatch).toBe(true);
    });

    it('should return isMatch false for invalid or empty input', async () => {
        const guard = await BurnerGuard.create();
        expect((await guard.verify('invalid-email')).isMatch).toBe(false);
        expect((await guard.verify('')).isMatch).toBe(false);
    });

    it('should return matchedOn "blocklist" for static matches', async () => {
        const guard = await BurnerGuard.create();
        const result = await guard.verify('user@yopmail.com');
        expect(result.isMatch).toBe(true);
        expect(result.matchedOn).toBe('blocklist');
    });

    it('should return null matchedOn for non-matches', async () => {
        const guard = await BurnerGuard.create();
        const result = await guard.verify('user@gmail.com');
        expect(result.isMatch).toBe(false);
        expect(result.matchedOn).toBeNull();
    });

    it('should return detailed result for an allowlisted domain', async () => {
        const guard = await BurnerGuard.create({
            additionalAllowedDomains: ['yopmail.com']
        });
        const result = await guard.verify('user@yopmail.com');
        expect(result.isMatch).toBe(false);
        expect(result.domain).toBe('yopmail.com');
        expect(result.matchedOn).toBeNull();
        expect(result.isAllowlisted).toBe(true);
    });

    it('should return null domain for invalid input', async () => {
        const guard = await BurnerGuard.create();
        const result = await guard.verify('');
        expect(result.isMatch).toBe(false);
        expect(result.domain).toBeNull();
    });

    it('should throw when apiKey is set (service mode not yet available)', async () => {
        const guard = await BurnerGuard.create({apiKey: 'bg_test_abc123'});
        await expect(guard.verify('test@yopmail.com')).rejects.toThrow(/service mode is not yet available/);
    });

    // --- verifyBatch ---

    it('should verify multiple emails in a batch', async () => {
        const guard = await BurnerGuard.create();
        const results = await guard.verifyBatch(['user@gmail.com', 'test@yopmail.com', 'foo@outlook.com']);
        expect(results).toHaveLength(3);
        expect(results[0].isMatch).toBe(false);
        expect(results[1].isMatch).toBe(true);
        expect(results[2].isMatch).toBe(false);
    });

    // --- filter ---

    it('should split emails into matched and clean', async () => {
        const guard = await BurnerGuard.create();
        const emails = ['user@gmail.com', 'test@5mail.cf', 'foo@yopmail.com'];
        const result = await guard.filter(emails);
        expect(result.matched).toEqual(['test@5mail.cf', 'foo@yopmail.com']);
        expect(result.clean).toEqual(['user@gmail.com']);
    });

    it('should return empty arrays for empty input', async () => {
        const guard = await BurnerGuard.create();
        const result = await guard.filter([]);
        expect(result.matched).toEqual([]);
        expect(result.clean).toEqual([]);
    });

    // --- hasMatch ---

    it('should return true if any email is a match', async () => {
        const guard = await BurnerGuard.create();
        expect(await guard.hasMatch(['user@gmail.com', 'test@5mail.cf'])).toBe(true);
        expect(await guard.hasMatch(['user@gmail.com', 'user@outlook.com'])).toBe(false);
    });

    // --- block / allow ---

    it('should block a domain at runtime', async () => {
        const guard = await BurnerGuard.create();
        expect((await guard.verify('test@my-new-spam.com')).isMatch).toBe(false);
        await guard.block('my-new-spam.com');
        expect((await guard.verify('test@my-new-spam.com')).isMatch).toBe(true);
    });

    it('should allow a domain at runtime, overriding the blocklist', async () => {
        const guard = await BurnerGuard.create();
        expect((await guard.verify('test@yopmail.com')).isMatch).toBe(true);
        await guard.allow('yopmail.com');
        expect((await guard.verify('test@yopmail.com')).isMatch).toBe(false);
    });

    it('should ignore empty strings when blocking or allowing', async () => {
        const guard = await BurnerGuard.create();
        const sizeBefore = guard.blocklistSize;
        await guard.block('');
        await guard.block('   ');
        expect(guard.blocklistSize).toBe(sizeBefore);
    });

    // --- Subdomain matching ---

    it('should detect subdomains of blocked domains', async () => {
        const guard = await BurnerGuard.create({
            sources: [{type: 'block', list: ['spammy.com']}]
        });
        expect((await guard.verify('user@spammy.com')).isMatch).toBe(true);
        expect((await guard.verify('user@mail.spammy.com')).isMatch).toBe(true);
        expect((await guard.verify('user@sub.mail.spammy.com')).isMatch).toBe(true);
        expect((await guard.verify('user@notspammy.com')).isMatch).toBe(false);
    });

    it('should detect subdomains with bare domain input', async () => {
        const guard = await BurnerGuard.create({
            sources: [{type: 'block', list: ['spammy.com']}]
        });
        expect((await guard.verify('spammy.com')).isMatch).toBe(true);
        expect((await guard.verify('mail.spammy.com')).isMatch).toBe(true);
        expect((await guard.verify('deep.sub.spammy.com')).isMatch).toBe(true);
    });

    it('should respect allowlist when checking subdomains', async () => {
        const guard = await BurnerGuard.create({
            sources: [
                {type: 'block', list: ['spammy.com']},
                {type: 'allow', list: ['legit.spammy.com']}
            ]
        });
        expect((await guard.verify('user@spammy.com')).isMatch).toBe(true);
        expect((await guard.verify('user@legit.spammy.com')).isMatch).toBe(false);
        expect((await guard.verify('user@other.spammy.com')).isMatch).toBe(true);
    });

    // --- Utilities ---

    it('should extract domain from email', async () => {
        const guard = await BurnerGuard.create();
        expect(guard.extractDomain('user@gmail.com')).toBe('gmail.com');
        expect(guard.extractDomain('USER@GMAIL.COM')).toBe('gmail.com');
        expect(guard.extractDomain('invalid')).toBeNull();
    });

    it('should validate email syntax', async () => {
        const guard = await BurnerGuard.create();
        expect(guard.isValidEmail('user@example.com')).toBe(true);
        expect(guard.isValidEmail('user@domain.co.uk')).toBe(true);
        expect(guard.isValidEmail('invalid')).toBe(false);
        expect(guard.isValidEmail('')).toBe(false);
    });

    // --- Properties ---

    it('should expose blocklistSize and allowlistSize', async () => {
        const guard = await BurnerGuard.create({useBundledAllowlist: true});
        expect(guard.blocklistSize).toBeGreaterThan(1000);
        expect(guard.allowlistSize).toBeGreaterThan(0);
    });
});
