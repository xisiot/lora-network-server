'use strict';

const BluebirdPromise = require('bluebird');
const utils = require('../../lib/lora-lib/utils');

function MessageQueue(redis) {
  this._ioredis = redis;
}

MessageQueue.prototype.consume = function (mq) {

  let _this = this;
  return _this._ioredis.lpop(mq).then(function (res) {
    return BluebirdPromise.resolve(!res ? res : JSON.parse(res));
  });
};

MessageQueue.prototype.checkQueueLength = function (mq) {

  let _this = this;
  return _this._ioredis.llen(mq).then(function (res) {
    return BluebirdPromise.resolve(res);
  });
};

module.exports = MessageQueue;
