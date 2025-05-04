import * as ts from 'typescript';
import path = require('node:path');
import fs = require('node:fs');

function compileWithConfig(fileToCompile: string) {
  const configPath = ts.findConfigFile('./', ts.sys.fileExists, 'tsconfig.json');
  if (!configPath) {
    console.error('Could not find a valid tsconfig.json in the project root.');
    process.exit(1);
  }

  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  if (configFile.error) {
    const message = ts.flattenDiagnosticMessageText(configFile.error.messageText, '\n');
    console.error(`Error reading tsconfig.json: ${message}`);
    process.exit(1);
  }

  const parsedCommandLine = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    path.dirname(configPath)
  );

  const program = ts.createProgram([fileToCompile], parsedCommandLine.options);
  const emitResult = program.emit();

  const diagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);
  diagnostics.forEach(diagnostic => {
    if (diagnostic.file && diagnostic.start !== undefined) {
      const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
      const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
      console.error(`${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`);
    } else {
      const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
      console.error(message);
    }
  });

  const exitCode = emitResult.emitSkipped ? 1 : 0;
  process.exit(exitCode);
}

// Entry point
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: ts-node compile.ts <path-to-file>');
  process.exit(1);
}

const inputFile = path.resolve(args[0]);
if (!fs.existsSync(inputFile)) {
  console.error(`The file "${inputFile}" does not exist.`);
  process.exit(1);
}

compileWithConfig(inputFile);
