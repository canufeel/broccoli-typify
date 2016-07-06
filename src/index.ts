/// <reference path="../types/all.d.ts" />
'use strict';

import {Compiler} from './broccoli-typescript';
import * as ts from 'typescript';

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

/**
 * Re-export the Compiler Plugin.
 */
export {Compiler};

