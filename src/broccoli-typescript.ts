/// <reference path="../types/all.d.ts" />

import fs = require('fs');
import fse = require('fs-extra');
import path = require('path');
import debugImport = require('debug');
import * as ts from 'typescript';
import { wrapDiffingPlugin, DiffingBroccoliPlugin, DiffResult } from './diffing-broccoli-plugin';

type FileRegistry = ts.Map<{ version: number }>;

const FS_OPTS = {
  encoding: 'utf-8'
};

var debug = debugImport('broccoli-typify:typescript');

var compilerInstance = 0;

export interface DiffingCompilerOptions {
  tsOptions: ts.CompilerOptions,
  localTypesFolder?: string,
  rootFilePaths?: string[],
  includeExtensions?: string[],
  instanceName?: string
}

/**
 * Broccoli plugin that implements incremental Typescript compiler.
 *
 * It instantiates a typescript compiler instance that keeps all the state about the project and
 * can re-emit only the files that actually changed.
 *
 * Limitations: only files that map directly to the changed source file via naming conventions are
 * re-emitted. This primarily affects code that uses `const enum`s, because changing the enum value
 * requires global emit, which can affect many files.
 */
class DiffingTSCompiler implements DiffingBroccoliPlugin {
  private tsOpts: ts.CompilerOptions;
  private fileRegistry: FileRegistry = Object.create(null);
  private rootFilePaths: string[];
  private tsServiceHost: ts.LanguageServiceHost;
  private tsService: ts.LanguageService;
  private firstRun: boolean = true;
  private previousRunFailed: boolean = false;
  private instanceName: string;

  static includeExtensions = ['.ts', '.js'];

  private debugWithName(msg: string) {
    debug(`[name ${this.instanceName}] ${msg}`);
  }

  constructor(public inputPath: string, public cachePath: string, public options?: DiffingCompilerOptions) {
    if (options && options.rootFilePaths) {
      this.rootFilePaths = options.rootFilePaths.splice(0);
    } else {
      this.rootFilePaths = [];
    }

    if (options && options.includeExtensions) {
      DiffingTSCompiler.includeExtensions = options.includeExtensions;
    }

    this.tsOpts = (options && clone(options.tsOptions)) || {};

    this.tsOpts.rootDir = inputPath;
    this.tsOpts.outDir = this.cachePath;
    this.instanceName = this.options.instanceName + ':' + (compilerInstance++);

    if (this.rootFilePaths && this.rootFilePaths.length) {
      debug("CustomLanguageServiceHost rootFilePaths " + this.rootFilePaths.join(";"));
    }
    debug(`[name ${this.instanceName}] CustomLanguageServiceHost inputPath ${this.inputPath}`);
    let localTypesFolder = options.localTypesFolder || `${process.cwd()}/local-types`;
    this.tsServiceHost = new CustomLanguageServiceHost(
      this.tsOpts,
      this.rootFilePaths,
      this.fileRegistry,
      this.inputPath,
      localTypesFolder,
      this.instanceName);
    this.tsService = ts.createLanguageService(this.tsServiceHost, ts.createDocumentRegistry());
  }


  rebuild(treeDiff: DiffResult) {
    let pathsToEmit: string[] = [];
    let pathsWithErrors: string[] = [];
    let errorMessages: string[] = [];

    this.debugWithName(`entering build, firstRun: ${this.firstRun}`);

    treeDiff.addedPaths.concat(treeDiff.changedPaths).forEach((tsFilePath) => {
      if (!this.fileRegistry[tsFilePath]) {
        this.fileRegistry[tsFilePath] = { version: 0 };
        this.rootFilePaths.push(tsFilePath);
      } else {
        this.fileRegistry[tsFilePath].version++;
      }

      pathsToEmit.push(path.join(this.inputPath, tsFilePath));
    });

    treeDiff.removedPaths.forEach((tsFilePath) => {

      this.rootFilePaths.splice(this.rootFilePaths.indexOf(tsFilePath), 1);
      this.fileRegistry[tsFilePath] = null;
      this.removeOutputFor(tsFilePath);
    });

    if (this.firstRun) {
      this.firstRun = false;
      this.doFullBuild();
    } else {
      let program = this.tsService.getProgram();
      pathsToEmit.forEach((tsFilePath) => {
        let output = this.tsService.getEmitOutput(tsFilePath);

        if (output.emitSkipped) {
          // there was an error, report it
          let errorFound = this.collectErrors(tsFilePath);
          if (errorFound) {
            pathsWithErrors.push(tsFilePath);
            errorMessages.push(errorFound);
          }
        } else {
          output.outputFiles.forEach(o => {
            let destDirPath = path.dirname(o.name);
            fse.mkdirsSync(destDirPath);
            fs.writeFileSync(o.name, o.text, FS_OPTS);
            if (endsWith(o.name, '.d.ts')) {
              const sourceFile = program.getSourceFile(tsFilePath);
            }
          });
        }
      });

      if (pathsWithErrors.length) {
        this.previousRunFailed = true;
        var error =
          new Error(`[name ${this.instanceName}] Typescript found the following errors:\n` + errorMessages.join('\n'));
        (<any>error)['showStack'] = false;
        throw error;
      } else if (this.previousRunFailed) {
        this.doFullBuild();
      }
    }
  }

  private collectErrors(tsFilePath: string): string {
    let allDiagnostics = this.tsService.getCompilerOptionsDiagnostics()
      .concat(this.tsService.getSyntacticDiagnostics(tsFilePath))
      .concat(this.tsService.getSemanticDiagnostics(tsFilePath));
    let errors: string[] = [];

    allDiagnostics.forEach(diagnostic => {
      let message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
      if (diagnostic.file) {
        let {line, character} = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
        errors.push(`  ${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`);
      } else {
        errors.push(`  Error: ${message}`);
      }
    });

    if (errors.length) {
      return errors.join('\n');
    }
  }

  private doFullBuild() {
    let program = this.tsService.getProgram();
    let typeChecker = program.getTypeChecker();
    let diagnostics: ts.Diagnostic[] = [];

    let emitResult = program.emit(undefined, (absoluteFilePath, fileContent) => {
      fse.mkdirsSync(path.dirname(absoluteFilePath));
      fs.writeFileSync(absoluteFilePath, fileContent, FS_OPTS);
    });
    if (emitResult.emitSkipped) {
      let allDiagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);
      let errorMessages: string[] = [];

      allDiagnostics.forEach(diagnostic => {
        var pos = '';
        if (diagnostic.file) {
          var {line, character} = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
          pos = `${diagnostic.file.fileName} (${line + 1}, ${character + 1}): `
        }
        var message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
        errorMessages.push(`  ${pos}${message}`);
      });

      if (errorMessages.length) {
        this.previousRunFailed = true;
        var error =
          new Error(`[name ${this.instanceName}] Typescript found the following errors:\n` + errorMessages.join('\n'));
        (<any>error)['showStack'] = false;
        throw error;
      } else {
        this.previousRunFailed = false;
      }
    }
  }

  private removeOutputFor(tsFilePath: string) {
    let absoluteJsFilePath = path.join(this.cachePath, tsFilePath.replace(/\.ts$/, '.js'));
    let absoluteMapFilePath = path.join(this.cachePath, tsFilePath.replace(/.ts$/, '.js.map'));
    let absoluteDtsFilePath = path.join(this.cachePath, tsFilePath.replace(/\.ts$/, '.d.ts'));

    if (fs.existsSync(absoluteJsFilePath)) {
      fs.unlinkSync(absoluteJsFilePath);
      if (fs.existsSync(absoluteMapFilePath)) {
        // source map could be inline or not generated
        fs.unlinkSync(absoluteMapFilePath);
      }
      fs.unlinkSync(absoluteDtsFilePath);
    }
  }
}

function fileExists(fileName: string): boolean {
  return ts.sys.fileExists(fileName);
}

function readFile(fileName: string): string {
  return ts.sys.readFile(fileName);
}


class CustomLanguageServiceHost implements ts.LanguageServiceHost {
  private currentDirectory: string;
  private defaultLibFilePath: string;


  constructor(
    private compilerOptions: ts.CompilerOptions,
    private fileNames: string[],
    private fileRegistry: FileRegistry,
    private treeInputPath: string,
    private localTypesFolder: string,
    private instanceName: string
  ) {
    this.currentDirectory = process.cwd();
    this.defaultLibFilePath = ts.getDefaultLibFilePath(compilerOptions).replace(/\\/g, '/');
  }


  getScriptFileNames(): string[] {
    return this.fileNames.map(f => path.join(this.treeInputPath, f));
  }


  getScriptVersion(fileName: string): string {
    if (startsWith(fileName, this.treeInputPath)) {
      const key = fileName.substr(this.treeInputPath.length + 1);
      return this.fileRegistry[key] && this.fileRegistry[key].version.toString();
    }
  }


  getScriptSnapshot(tsFilePath: string): ts.IScriptSnapshot {
    // TypeScript seems to request lots of bogus paths during import path lookup and resolution,
    // so we we just return undefined when the path is not correct.

    // Ensure it is in the input tree, an imported @type files or lib/*d.ts file.
    if (!startsWith(tsFilePath, this.treeInputPath)
      && tsFilePath.indexOf('/node_modules/@types/') === -1
      && tsFilePath.indexOf('/node_modules/at-types') === -1
      && tsFilePath.indexOf(this.localTypesFolder) === -1
      && !tsFilePath.match(/\/lib(\..*)*.d\.ts$/)) {
      if (fs.existsSync(tsFilePath)) {
        console.log('Rejecting', tsFilePath, '. File is not in the input tree.');
      }
      return undefined;
    }

    // Ensure it exists
    if (!fs.existsSync(tsFilePath)) {
      return undefined;
    }

    return ts.ScriptSnapshot.fromString(fs.readFileSync(tsFilePath, FS_OPTS));
  }


  getCurrentDirectory(): string { return this.currentDirectory; }

  getCompilationSettings(): ts.CompilerOptions { return this.compilerOptions; }

  getDefaultLibFileName(options: ts.CompilerOptions): string {
    // ignore options argument, options should not change during the lifetime of the plugin
    return this.defaultLibFilePath;
  }

  resolveModuleNames(moduleNames: string[], containingFile: string): ts.ResolvedModule[] {
    return moduleNames.map(name => {
      // first try the default resolution
      let result = ts.resolveModuleName(name, containingFile, this.compilerOptions, { fileExists, readFile });
      if (result.resolvedModule) {
        return result.resolvedModule;
      }
      let candidatePaths: string[] = [];

      if (name === 'ember') {
        // custom repo for ember resolution while we stabilize the type definition
        candidatePaths.push(`${this.currentDirectory}/node_modules/at-types-ember/index.d.ts`);
      }
      if (name.match(/\/config\/environment$/)) {
        candidatePaths.push(`${this.localTypesFolder}/ember-config-environment.d.ts`);
      } else {
        // resolve npm: modules as loaded with ember-browserify.
        // the end goal is to have all the types coming from npm @types,
        // however we support a local-types for development.
        const module = (name.indexOf('npm:') === 0) ? name.split(':')[1] : name;
        candidatePaths.push(`${this.localTypesFolder}/${module}/index.d.ts`);
        candidatePaths.push(`${this.currentDirectory}/node_modules/@types/${module}/index.d.ts`);
      }
      for (let i = 0; i < candidatePaths.length; i++) {
        if (fs.existsSync(candidatePaths[i])) {
          return {
            resolvedFileName: candidatePaths[i],
            isExternalLibraryImport: true
          }
        }
      }
      (`[name ${this.instanceName}] resolveModuleNames skipping module '${name}'`);
      return undefined;
    });
  }
}

export var Compiler = wrapDiffingPlugin(DiffingTSCompiler);




function clone<T>(object: T): T {
  const result: any = {};
  for (const id in object) {
    result[id] = (<any>object)[id];
  }
  return <T>result;
}

function startsWith(str: string, substring: string): boolean {
  return str.substring(0, substring.length) === substring;
}

function endsWith(str: string, substring: string): boolean {
  return str.indexOf(substring, str.length - substring.length) !== -1;
}
