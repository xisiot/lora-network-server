'use strict';

const _ = require('lodash');
const crypto = require('crypto');
const BluebirdPromise = require('bluebird');
const loraLib = require('../lora-lib');
const { consts, utils } = loraLib;
const config = require('../../config');

function DeDuplication(DeDuplication) {
  this.redisClient = DeDuplication._ioredis;
}

DeDuplication.prototype.handle = function (uplinkDataJson) {

  let _this = this;
  let redisPipeline = _this.redisClient.pipeline();
  const uplinkDataStr = JSON.stringify(uplinkDataJson);
  const rawData = uplinkDataJson.rxpk.raw;

  if (_.isString(rawData) && rawData.length !== 0) {

    const key = consts.COLLECTKEYTEMP_PREFIX + rawData;
    const lockKey = consts.COLLECTLOCKKEYTEMP_PREFIX + rawData;
    const deduplicationTTL = config.server.deduplication_Delay * 2;

    redisPipeline.sadd(key, uplinkDataStr);
    redisPipeline.pexpire(key, deduplicationTTL);
    return redisPipeline.exec(function (err, results) {

      if (err) {
        return BluebirdPromise.reject(new Error(JSON.stringify({
          deDuplicationError: 'add rx packet to collect set error: %s',
          message: err.message,
        })));
      }

    }).then(function () {
      return _this.redisClient.set(lockKey, uplinkDataStr, 'NX', 'PX', deduplicationTTL);
    }).then(function (res) {
      if (res === 'OK') {
        let promiseReturn = new BluebirdPromise(function (resolve, reject) {
          setTimeout(_this.consume_sortRXInfo.bind(_this),
            config.server.deduplication_Delay, resolve, reject, key);
        });

        return promiseReturn;
      } else {
        return BluebirdPromise.resolve(null);
      }
    });
  } else {
    return BluebirdPromise.reject(new Error('deDuplication : Input rawData type error'));
  }
};

DeDuplication.prototype.consume_sortRXInfo = function (resolve, reject, key) {
  let _this = this;

  const sortRXInfo = function (rxInfoA, rxInfoB) {
    const maxSNRForSort = 5.0;
    if (rxInfoA.rxpk.lsnr === rxInfoB.rxpk.lsnr) {
      return rxInfoB.rxpk.rssi - rxInfoA.rxpk.rssi;
    }

    if (rxInfoA.rxpk.lsnr > maxSNRForSort && rxInfoB.rxpk.lsnr > maxSNRForSort) {
      return rxInfoB.rxpk.rssi - rxInfoA.rxpk.rssi;
    }

    return rxInfoB.rxpk.lsnr - rxInfoA.rxpk.lsnr;
  };

  return _this.redisClient.smembers(key).then(function (res) {
    if (res.length === 0) {
      return reject(new Error('deDuplication : zero items in collect set'));
    } else {
      res.forEach(function (element, index) {
        if (typeof element === 'string') {
          try {
            res[index] = JSON.parse(element, function (key, value) {
              return value && value.type === 'Buffer' ? Buffer.from(value.data) : value;
            });
          } catch (err) {
            res[index] = element;
          }
        }
      });

      res.sort(sortRXInfo);
      return resolve(res);
    }
  });
};

module.exports = DeDuplication;
