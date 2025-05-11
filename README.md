# Suite-Ops

A command-line tool for compiling TypeScript files for NetSuite SuiteScript and uploading them to NetSuite.

## Installation

```bash
npm install -g suite-ops
```

## Usage

### Command Line

```bash
suite-compile path/to/your/file.ts
```

This will:
1. Run Biome formatting on your TypeScript file
2. Compile the TypeScript file using your project's tsconfig.json
3. Upload the compiled JavaScript file to NetSuite

### Programmatic Usage

```typescript
import { compile } from 'suite-ops';

// Compile and upload a file
compile('path/to/your/file.ts')
  .then(() => {
    console.log('Compilation and upload successful');
  })
  .catch((error) => {
    console.error('Error:', error);
  });
```

## Requirements

- Node.js 14 or higher
- A valid NetSuite account and SuiteCloud CLI setup
- TypeScript project with a valid tsconfig.json

## License

ISC

## Author

Ben Bahrman
