
'use strict';
var process = require('process');
var fs = require('fs');
var broccoli = require('broccoli');
var Typify = require('../');

var path = process.argv[2];

if (!path || !fs.existsSync(path)) {
  console.error("Need a directory to process");
  process.exit(2);
}


var builder = new broccoli.Builder(Typify.Compiler(path));
builder.build().then(function (results) {
    console.log('success');
    process.exit(0);
}, function (fail) {
    console.log(fail.message);
    process.exit(1);
});
