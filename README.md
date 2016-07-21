Process typescript files and resolves type defintions to @types.

## Credits

Broccoli typescript interfaces extracted from Angular:

https://github.com/angular/angular/blob/master/tools/broccoli/broccoli-typescript.ts

Tests and use cases extracted from:

https://github.com/tildeio/broccoli-typescript-compiler

## Resolution

Most of the resolution needs can be handled with settings in the tsconfig.json file.
https://github.com/Microsoft/TypeScript/issues/9834


## Ember-cli integration

In the context of broccoli plugins a relative baseUrl does not work, it needs to
point to the location of tsconfig file (or rather be relative to it).
