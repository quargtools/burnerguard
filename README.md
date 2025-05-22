# Disposable Email Checker

A highly efficient and robust Node.js library for detecting disposable (burner) email domains. Powered by the publicly available and frequently updated [disposable-email-domains blocklist](https://github.com/disposable-email-domains/disposable-email-domains), this library is optimized for low-resource environments and guarantees a fully initialized checker instance.

---

## Features

* **Optimized Performance:** Utilizes a `Set` for lightning-fast $O(1)$ average time complexity domain lookups.
* **Robust Email Validation:** Integrates a comprehensive email validation regex (derived from Angular's robust form validation) before extracting and checking the domain.
* **Flexible Loading:**
    * **Bundled Data (Default):** Ready to use out-of-the-box with an included, pre-processed blocklist for immediate synchronous checks after initial async creation.
    * **Local File Path:** Load the blocklist from a file on disk.
    * **Remote URL:** Load the blocklist directly from a URL (e.g., the upstream GitHub repository).
* **Asynchronous Factory Function:** Guarantees that you always receive a fully initialized and ready-to-use `DisposableEmailChecker` instance.
* **TypeScript Support:** Written entirely in TypeScript for type safety and improved developer experience.
* **Low Resource Footprint:** Designed with memory and CPU efficiency in mind, making it suitable for serverless functions, IoT devices, or other constrained environments.

---

## Installation

```bash
npm install @floracodex/disposable-email-checker
# or
yarn add @floracodex/disposable-email-checker
```

## Usage

Using `@floracodex/disposable-email-checker` is straightforward. You'll create an instance using the static `create` method, which handles loading the blocklist asynchronously. Once created, domain checks are synchronous and extremely fast.

### Checking a Single Email

```typescript

import {DisposableEmailChecker} from 'disposable-email-checker';

async function checkEmail(email: string) {
    try {
        // Create the checker instance. This loads the blocklist.
        // By default, it loads the bundled blocklist.
        const checker = await DisposableEmailChecker.create();

        // Perform the check (this is now synchronous and very fast!)
        const isDisposable = checker.isDisposable(email);

        console.log(`Email: ${email}, Is Disposable: ${isDisposable}`);
        return isDisposable;

    } catch (error) {
        console.error('Failed to initialize DisposableEmailChecker or check email:', error);
        // Handle initialization error appropriately (e.g., log, return default, throw)
        return false; // Or throw new Error('Service unavailable');
    }
}

// Example usage
checkEmail('test@mail.com');        // Likely true
checkEmail('user@gmail.com');       // Likely false
checkEmail('invalid-email');        // Always false (due to validation)
checkEmail('another@yopmail.com');  // Likely true
```

### Checking Multiple Emails (Batch)

For better efficiency, you can check multiple emails at once.

```typescript
import {DisposableEmailChecker} from 'disposable-email-checker';

async function checkMultipleEmails(emails: string[]) {
    try {
        const checker = await DisposableEmailChecker.create();

        // Check all emails in a batch
        const results = checker.checkEmails(emails); // Returns boolean[]
        console.log('Batch results:', results);

        // Or check if *any* email in the list is disposable
        const containsDisposable = checker.containsDisposable(emails); // Returns boolean
        console.log('Contains disposable email:', containsDisposable);

        return {results, containsDisposable};

    } catch (error) {
        console.error('Failed to process multiple emails:', error);
        return {results: [], containsDisposable: false};
    }
}

const emailList = [
    'user1@example.com',        // Likely not disposable
    'user2@tempmail.com',       // Likely disposable
    'user3@domain.org',         // Likely not disposable
    'user4@disposable.net',     // Likely disposable
    'invalid@email.com'         // Invalid, so not disposable
];

checkMultipleEmails(emailList);
```

### Loading from a Specific File Path

You can configure the checker to load the blocklist from a local file on your system. This is useful for custom lists or if you're managing updates externally.

```typescript
import {DisposableEmailChecker} from 'disposable-email-checker';
import * as path from 'path';

async function checkFromFile() {
    const customBlocklistPath = path.join(__dirname, 'my_custom_disposable_domains.txt');
    // Make sure 'my_custom_disposable_domains.txt' exists at this path!
    // Example content:
    // mytempmail.com
    // blockthis.org

    try {
        const checker = await DisposableEmailChecker.create({filePath: customBlocklistPath});
        console.log(`Checker initialized from ${customBlocklistPath}`);

        console.log('user@mytempmail.com is disposable:', checker.isDisposable('user@mytempmail.com'));
        console.log('user@blockthis.org is disposable:', checker.isDisposable('user@blockthis.org'));
        console.log('user@gmail.com is disposable:', checker.isDisposable('user@gmail.com'));

    } catch (error) {
        console.error('Failed to load from custom file:', error);
    }
}

checkFromFile();
```

### Loading from a Remote URL

This option allows you to point directly to the upstream source or any other URL serving the blocklist content.

```typescript
import {DisposableEmailChecker} from 'disposable-email-checker';

async function checkFromUrl() {
    const upstreamUrl = '[https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/main/disposable_email_blocklist.conf](https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/main/disposable_email_blocklist.conf)';

    try {
        const checker = await DisposableEmailChecker.create({url: upstreamUrl});
        console.log(`Checker initialized from ${upstreamUrl}`);

        console.log('test@mail.com is disposable:', checker.isDisposable('test@mail.com'));
        console.log('test@yopmail.com is disposable:', checker.isDisposable('test@yopmail.com'));
        console.log('user@gmail.com is disposable:', checker.isDisposable('user@gmail.com'));

    } catch (error) {
        console.error('Failed to load from URL:', error);
    }
}

checkFromUrl();
```

## Bundled Data & Updates

This library comes with a pre-processed version of the `disposable-email-domains` blocklist. This means it works out-of-the-box without needing an internet connection or file system access (unless you explicitly configure it to use a `filePath` or `url`).

### Keeping the Bundled List Updated

As the `disposable-email-domains` project is actively maintained, the bundled list can become outdated. To update the bundled list within your project:

1. **Run the update script:**
    ```bash
    npm run update-blocklist
    ```
   
    This script fetches the latest blocklist from the upstream GitHub repository and saves it to `data/BLOCKLIST` in your project's root.

2. **Rebuild your project:**
    ```bash
   npm run build
    ```
   
    This ensures the newly updated data/disposable_domains.txt is bundled into your library's dist output.

## Acknowledgements

* Inspired by and utilizing the invaluable [disposable-email-domains](https://github.com/disposable-email-domains/disposable-email-domains) project.
* Email validation regex derived from [Angular's form validation](https://github.com/angular/angular/blob/6dd8cce155d36daad11fa07d9732d6079cd3646a/packages/forms/src/validators.ts#L146-L147).

## License

This project is licensed under the [MIT License](https://github.com/floracodex/nestjs-secrets/blob/main/LICENSE).
