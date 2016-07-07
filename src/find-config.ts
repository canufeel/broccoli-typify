'use strict';

import findup = require('findup');

export default function(root: string): string {
  return findup.sync(root, 'package.json') + '/tsconfig.json';
};
