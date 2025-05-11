import * as ts from 'typescript';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { exec, execSync } from 'child_process';

/**
 * Runs Biome fix on the specified TypeScript file
 * @param fileToCompile Path to the TypeScript file to fix
 * @returns boolean indicating success or failure
 */
const runBiomeFix = (fileToCompile: string) => {
  try {
    console.log(`Running Biome fix on ${fileToCompile}...`);
    execSync(`npx @biomejs/biome check --write ${fileToCompile}`, { stdio: 'inherit' });
    console.log('Biome fix completed successfully.');
    return true;
  } catch (error) {
    console.error(`Error running Biome fix: ${error}`);
    return false;
  }
}

/**
 * Compiles a TypeScript file using the project's tsconfig.json
 * and uploads the compiled JavaScript to NetSuite
 * @param fileToCompile Path to the TypeScript file to compile
 * @returns Promise that resolves when compilation and upload are complete
 */
const compileWithConfig = (fileToCompile: string) => {
  return new Promise<boolean>((resolve, reject) => {
    const configPath = ts.findConfigFile('./', ts.sys.fileExists, 'tsconfig.json');
    if (!configPath) {
      const error = 'Could not find a valid tsconfig.json in the project root.';
      console.error(error);
      reject(new Error(error));
      return;
    }

    const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
    if (configFile.error) {
      const message = ts.flattenDiagnosticMessageText(configFile.error.messageText, '\n');
      const error = `Error reading tsconfig.json: ${message}`;
      console.error(error);
      reject(new Error(error));
      return;
    }

    const parsedCommandLine = ts.parseJsonConfigFileContent(
      configFile.config,
      ts.sys,
      path.dirname(configPath)
    );

    const program = ts.createProgram([fileToCompile], parsedCommandLine.options);
    const emitResult = program.emit();

    const diagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);
    let hasErrors = false;
    
    // loop through and log out any compilation errors
    diagnostics.forEach(diagnostic => {
      if (diagnostic.file && diagnostic.start !== undefined) {
        const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
        const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
        console.error(`${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`);
        if (diagnostic.category === ts.DiagnosticCategory.Error) {
          hasErrors = true;
        }
      } else {
        const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
        console.error(message);
        if (diagnostic.category === ts.DiagnosticCategory.Error) {
          hasErrors = true;
        }
      }
    });

    if (emitResult.emitSkipped || hasErrors) {
      reject(new Error('Compilation failed with errors'));
    } else {
      resolve(true);
    }
  });
}

const uploadFileToAccount = (tsFilePath: string) => {
  return new Promise<void>((resolve, reject) => {
    const jsFilePath = getSuiteScriptPath(tsFilePath);
    exec(`suitecloud file:upload --paths "${jsFilePath}"`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing suitecloud command: ${error.message}`);
        reject(error);
        return;
      }
      if (stderr) {
        console.error(`suitecloud stderr: ${stderr}`);
      }
      console.log(`suitecloud stdout: ${stdout}`);
      console.log('File upload completed successfully.');
      resolve();
    });
  });
}

const getSuiteScriptPath = (filePath: string) => {
  const pathParts = filePath.replace(/\.ts$/, '.js').split(path.sep);
  let suiteScriptsIndex = pathParts.findIndex(part => part === 'SuiteScripts');
  
  let suiteScriptsPath;
  if (suiteScriptsIndex !== -1) {
    // If SuiteScripts is in the path, preserve the structure from that point
    const relativePath = pathParts.slice(suiteScriptsIndex).join('/');
    suiteScriptsPath = `/${relativePath}`;
  } else {
    // If SuiteScripts is not in the path, just use the filename
    const fileName = path.basename(filePath.replace(/\.ts$/, '.js'));
    suiteScriptsPath = `/SuiteScripts/${fileName}`;
  }
  const jsFilePath = `/src/FileCabinet${suiteScriptsPath}`;

  console.log(`Compilation successful. Uploading ${jsFilePath} to NetSuite as ${suiteScriptsPath}...`);
}

/**
 * Validates the input file exists
 * @param filePath Path to the file to validate
 * @throws Error if the file doesn't exist
 */
const validateInputFile = (filePath: string) => {
  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`The file "${resolvedPath}" does not exist.`);
  }
  return resolvedPath;
}

/**
 * Main compile function that can be called programmatically or via CLI
 * @param filePath Path to the TypeScript file to compile
 * @returns Promise that resolves when compilation and upload are complete
 */
export const compile = async (filePath: string) => {
  try {
    const inputFile = validateInputFile(filePath);
    
    // Run Biome fix first, then compile
    const biomeSuccess = runBiomeFix(inputFile);
    if (biomeSuccess) {
      const compileResult = await compileWithConfig(inputFile);
      if (compileResult) {
        await uploadFileToAccount(inputFile);
      }
    } else {
      throw new Error('Biome fix failed. Compilation aborted.');
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
