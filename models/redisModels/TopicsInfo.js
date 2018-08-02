'use strict';
const config = require('../../config');

function TopicsInfo(redis) {
  this._ioredis = redis;
}

TopicsInfo.prototype.addNewDeviceTopics = function (did, shadowConfig) {

  let _this = this;
  let pipeline = this._ioredis.pipeline();
  let topicsValues = `${shadowConfig.cloudId}:${shadowConfig.loraId}`;

  shadowConfig.suffix.forEach(suffixElement => {
    let topic = shadowConfig.prefix + did + suffixElement;
    pipeline.sadd(topic, topicsValues);
  });

  return pipeline.exec();
};

module.exports = TopicsInfo;
