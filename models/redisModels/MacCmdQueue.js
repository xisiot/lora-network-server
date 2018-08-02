'use strict';

const BluebirdPromise = require('bluebird');

function MacCmdQueue(redis) {
  this._ioredis = redis;
}

MacCmdQueue.prototype.read = function (mq, start, stop) {

  let _this = this;
  let startIndex = 0;
  let stopIndex = -1;
  if (typeof start === 'number') {
    startIndex = start;
  }

  if (typeof stop === 'number') {
    stopIndex = stop;
  }

  return _this._ioredis.lrange(mq, startIndex, stopIndex).then((res) => {
    let queueArr = res;
    queueArr.forEach((element, index) => {
      try {
        queueArr[index] = JSON.parse(element);
      }
      catch (error) {
        queueArr[index] = element;
      }
    });

    return BluebirdPromise.resolve(queueArr);
  });
};

MacCmdQueue.prototype.consumeAll = function (mq) {

  let _this = this;

  return _this._ioredis.lrange(mq, 0, -1).then((res) => {
    let queueArr = res;
    queueArr.forEach((element, index) => {
      try {
        queueArr[index] = JSON.parse(element);
      }
      catch (error) {
        queueArr[index] = element;
      }
    });

    return BluebirdPromise.resolve(queueArr);
  }).then(queueArr =>
    this._ioredis.ltrim(mq, 1, 0).then(((res) => {
      if (res === 'OK') {
        return BluebirdPromise.resolve(queueArr);
      }

      return BluebirdPromise.reject(JSON.stringify({
        MacCmdQueError: 'MacCmdQueue failed to execute Redis LTRIM',
        redisKey: mq,
      }));
    }))
  );
};

module.exports = MacCmdQueue;
