/// <reference path="../types/all.d.ts" />
'use strict';

import debugImport = require('debug');
import { Compiler as BroccoliCompiler, DiffingCompilerOptions } from './broccoli-typescript';
import * as ts from 'typescript';
import findConfig from './find-config';
import fs = require('fs');
import path = require('path');

let debug = debugImport('broccoli-typify:main');

/**
 * Convert from a hash (possibly loaded from file) to Typescript Compiler Options.
 * The rationale for making this available separately is to be able to handle errors
 * in the configuration data.
 */
export function toTypescriptOptions(options: any, basePath: string): {
  options: ts.CompilerOptions;
  errors: ts.Diagnostic[];
} {

  return ts.convertCompilerOptionsFromJson(options, basePath);
}

export interface LoadedOptions {
  options: ts.CompilerOptions;
  errors: ts.Diagnostic[];
}

/**
 * Load the given tsconfig.json file.
 * If a relative baseUrl is present it is adjusted to the absolute path.
 */
function loadTsconfig(tsconfigPath: string): LoadedOptions {
  if (tsconfigPath) {
    let content = JSON.parse(fs.readFileSync(tsconfigPath).toString('utf8'));
    let options = content['compilerOptions'];
    if (options['baseUrl'] && !path.isAbsolute(options['baseUrl'])) {
      options['baseUrl'] = path.join(path.dirname(tsconfigPath), options['baseUrl']);
    }
    return ts.convertCompilerOptionsFromJson(options, tsconfigPath);
  }
  return {
    options: undefined, errors: [{
      file: null,
      start: undefined,
      length: undefined,
      messageText: "Cannot load file tsconfig.json",
      category: 2,
      code: -1,
    }]
  }
}

/**
 * Load the configuration from the tsconfig.json file for the consuming project.
 */
export function loadProjectTsconfig(root: string): LoadedOptions {
  const path = findConfig(root);
  return loadTsconfig(path);
}

export interface CompilerOptions extends DiffingCompilerOptions {
  tsconfig?: string;
}

export function Compiler(tree: BroccoliTree, options?: CompilerOptions): any {
  let resolvedOptions = options;
  if (!options || options.tsconfig) {
    var loaded = (options && options.tsconfig) ? loadTsconfig(options.tsconfig) : loadProjectTsconfig(__dirname);
    if (loaded.errors.length) {
      throw "Errors loading tsconfig " + loaded.errors.join("\n");
    }
    resolvedOptions = { tsOptions: loaded.options };
  }
  debug(`Initializing compiler with ${JSON.stringify(resolvedOptions)}`);
  return BroccoliCompiler(tree, resolvedOptions);
}
