'use strict';

function DeDuplication(redis) {
  this._ioredis = redis;
}

module.exports = DeDuplication;
