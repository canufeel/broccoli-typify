/// <reference path="../types/all.d.ts" />
'use strict';

import {Compiler as BroccoliCompiler, DiffingCompilerOptions} from './broccoli-typescript';
import * as ts from 'typescript';
import findConfig from './find-config';
import fs = require('fs');

/**
 * Convert from a hash (possibly loaded from file) to Typescript Compiler Options.
 * The rationale for making this available separately is to be able to handle errors
 * in the configuration data.
 */
export function toTypescriptOptions(options:any, basePath:string):{
  options:ts.CompilerOptions;
  errors:ts.Diagnostic[];
} {

  return ts.convertCompilerOptionsFromJson(options, basePath);
}

/**
 * Load the configuration from the tsconfig.json file for the consuming project.
 */

export function loadProjectTsconfig(root:string):{
  options:ts.CompilerOptions;
  errors:ts.Diagnostic[];
} {
  const path = findConfig(root);
  if (path) {
    var content = JSON.parse(fs.readFileSync(path).toString('utf8'));
    return ts.convertCompilerOptionsFromJson(content['compilerOptions'], path);
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
 * Re-export the Compiler Plugin, resolve file if not passed in.
 */
export {DiffingCompilerOptions};

export function Compiler(tree: BroccoliTree, options?: DiffingCompilerOptions): any {
  let resolvedOptions = options;
  if (!options) {
    var loaded = loadProjectTsconfig(__dirname);
    if (loaded.errors.length) {
      throw "Errors loading tsconfig " + loaded.errors.join("\n");
    }
    resolvedOptions = { tsOptions: loaded.options};
  }
  return BroccoliCompiler(tree, resolvedOptions);
}

