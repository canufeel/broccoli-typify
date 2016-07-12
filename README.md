Process typescript files and resolves type defintions to @types.

## Credits

Broccoli typescript interfaces extracted from Angular:

https://github.com/angular/angular/blob/master/tools/broccoli/broccoli-typescript.ts

Tests and use cases extracted from:

https://github.com/tildeio/broccoli-typescript-compiler

## Resolution

The imports of the type 'npm:<dependency>' expect have
corresponding type information either under node_modules/@types
or local-types. The latter location is provided to allow quick iterations
on type definitions before they are contributed back to @types.

For imports of ember itself the type information is additionally
looked under node_modules/at-types-ember, the type definition
is still being stabilized.
