/// <reference path="./external.d.ts" />
/// <reference path="./broccoli.d.ts" />

declare module 'broccoli-writer' {
  class Writer {
    write(readTree: (tree: BroccoliTree) => Promise<string>, destDir: string): Promise<any>;
  }
  export = Writer;
}
