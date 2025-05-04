import * as ts from 'typescript';
import path = require('node:path');
import fs = require('node:fs');
import { exec } from 'child_process';

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
  
  if (exitCode === 0) {
    // Get the output JavaScript file path    
    // Extract the path structure
    const pathParts = fileToCompile.replace(/\.ts$/, '.js').split(path.sep);
    let suiteScriptsIndex = pathParts.findIndex(part => part === 'SuiteScripts');
    
    let suiteScriptsPath;
    if (suiteScriptsIndex !== -1) {
      // If SuiteScripts is in the path, preserve the structure from that point
      const relativePath = pathParts.slice(suiteScriptsIndex).join('/');
      suiteScriptsPath = `/${relativePath}`;
    } else {
      // If SuiteScripts is not in the path, just use the filename
      const fileName = path.basename(fileToCompile.replace(/\.ts$/, '.js'));
      suiteScriptsPath = `/SuiteScripts/${fileName}`;
    }
    const jsFilePath = `/src/FileCabinet${suiteScriptsPath}`;

    
    console.log(`Compilation successful. Uploading ${jsFilePath} to NetSuite as ${suiteScriptsPath}...`);
    
    // Execute the suitecloud file:upload command
    exec(`suitecloud file:upload --paths "${suiteScriptsPath}"`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing suitecloud command: ${error.message}`);
        process.exit(1);
      }
      if (stderr) {
        console.error(`suitecloud stderr: ${stderr}`);
      }
      console.log(`suitecloud stdout: ${stdout}`);
      console.log('File upload completed successfully.');
      process.exit(0);
    });
  } else {
    process.exit(exitCode);
  }
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
