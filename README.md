Process typescript files and resolves type defintions to @types.

[Travis build status:] (https://travis-ci.org/winding-lines/broccoli-typify) ![Travis build status]
(https://travis-ci.org/winding-lines/broccoli-typify.svg?branch=master)

## Credits

Broccoli typescript interfaces extracted from Angular:

https://github.com/angular/angular/blob/master/tools/broccoli/broccoli-typescript.ts

Tests and use cases extracted from:

https://github.com/tildeio/broccoli-typescript-compiler

## Resolution

Most of the resolution needs can be handled with settings in the tsconfig.json file.
https://github.com/Microsoft/TypeScript/issues/9834


## Ember-cli integration

The type mappings are done through baseUrl and paths in the tsconfig.json.
For integration with the IDE the baseUrl can be just '.' which translates
to the current folder. However for broccoli plugins this does not work,
an absolute path is needed. The plugin takes care of that transformation.

Also noEmit is set to true in the basic tsconfig.json file to reduce
user errors where the user or IDE runs tsc and generates .js and .map files.
The plugin removes noEmit when using the configuration file during
actual brocoli pipeline.
