'use strict';

const BluebirdPromise = require('bluebird');
const config = require('../../config');
const pubJSTopic = config.mqClient_ns.topics.pubToJoinServer;
const loraLib = require('../lora-lib');
const { consts, ERROR } = loraLib;

function JoinResHandler(mqClient, redisConn, mysqlConn, log) {
  this.mqClient = mqClient;
  this.topicsInfo = redisConn.TopicsInfo;
  this.log = log;
  this.DeviceConfig = mysqlConn.DeviceConfig;
  this.DeviceInfoMysql = mysqlConn.DeviceInfo;
  this.DeviceStatus = mysqlConn.DeviceStatus;
  this.DeviceRouting = mysqlConn.DeviceRouting;
  this.DeviceInfoRedis = redisConn.DeviceInfo;
}

JoinResHandler.prototype.handler = function (convertedData) {

  let _this = this;

  // return BluebirdPromise.all([
  //   _this.DeviceStatus.createItem(convertedData),
  //   _this.updateJoinDeviceRouting(convertedData),
  // ]);
  return _this.updateJoinDeviceRouting(convertedData);
};

JoinResHandler.prototype.joinRequestHandle = function (joinResArr) {
  let _this = this;

  let joinResObj = joinResArr[0];
  _this.log.info({
    label: 'Send join message to JS-sub',
    message: joinResObj,
  });

  return _this.mqClient.publish(pubJSTopic, joinResObj);
};

JoinResHandler.prototype.updateJoinDeviceRouting = function (deviceStatus) {

  let _this = this;
  let freqPlanOffset;

  function getDatr(datr, RX1DROFFSET) {
    let dr = consts.DR_PARAM;
    let RX1DROFFSETTABLE = dr.RX1DROFFSETTABLE[freqPlanOffset];
    let DRUP = dr.DRUP[freqPlanOffset];
    let DRDOWN = dr.DRDOWN[freqPlanOffset];

    for (let key in DRDOWN) {
      if (RX1DROFFSETTABLE[DRUP[datr]][RX1DROFFSET] === DRDOWN[key]) {
        return key;
      }
    }

    return datr;
  }

  let whereOpts = { DevAddr: deviceStatus.DevAddr };
  // return _this.deviceConfig.read(whereOpts.DevAddr).then(function (res) {
  return _this.DeviceConfig.readItem(whereOpts).then(function (res) {
    if (res) {
      if (!res.frequencyPlan) {
        return BluebirdPromise.reject(
          new ERROR.DeviceNotExistError({
            'message': 'DevAddr does not exist frequencyPlan in DeviceConfig',
            'DevAddr': whereOpts.DevAddr,
          }));
      }

      if (!res.RX1DRoffset && res.RX1DRoffset !== 0) {
        return BluebirdPromise.reject(
          new ERROR.DeviceNotExistError({
            'message': 'DevAddr does not exist RX1DRoffset in DeviceConfig',
            'DevAddr': whereOpts.DevAddr,
          }));
      }

      freqPlanOffset = consts.FREQUENCY_PLAN_LIST.findIndex(function (value, index, array) {
        return value === res.frequencyPlan;
      });

      let updateOpts = {
        DevAddr: Buffer.from(deviceStatus.DevAddr, 'hex'),
        gatewayId: Buffer.from(deviceStatus.gatewayId, 'hex'),
        tmst: deviceStatus.tmst + consts.TXPK_CONFIG.TMST_OFFSET_JOIN,
        freq: consts.TXPK_CONFIG.FREQ[freqPlanOffset]
          (freqPlanOffset === consts.PLANOFFSET915 ? deviceStatus.chan : deviceStatus.freq),
        powe: consts.TXPK_CONFIG.POWE[freqPlanOffset],
        datr: getDatr(deviceStatus.datr, res.RX1DRoffset),
        modu: deviceStatus.modu,
        codr: deviceStatus.codr,
      };

      let devInfo = {
        frequencyPlan: res.frequencyPlan,
        ADR: res.ADR,
        RX1DRoffset: res.RX1DRoffset,
        RX1Delay: res.RX1Delay
      };

      const query = {
        DevAddr: updateOpts.DevAddr
      };

      // updateOpts.DevAddr = Buffer.from(deviceStatus.DevAddr, 'hex');
      return _this.DeviceRouting.upsertItem(updateOpts)
        .then(() => {
          return _this.DeviceInfoMysql.readItem(query, consts.DEVICEINFO_CACHE_ATTRIBUTES);
        })
        .then((res) => {
          Object.keys(res).forEach((key) => {
            devInfo[key] = res[key];
          });
          return _this.DeviceRouting.readItem(query, consts.DEVICEROUTING_CACHE_ATTRIBUTES);
        })
        .then((res) => {
          Object.keys(res).forEach((key) => {
            devInfo[key] = res[key];
          });
          // console.log(devInfo);
          return _this.DeviceInfoRedis.update(updateOpts.DevAddr, devInfo);
        });
        // .then(() => {
        //   return _this.DeviceInfoRedis.read(updateOpts.DevAddr)
        //     .then((res) => {
        //       console.log('from redis');
        //       console.log(res);
        //     });
        // });
    }

    return BluebirdPromise.reject(
      new ERROR.DeviceNotExistError({
        'message': 'DevAddr does not exist in DeviceConfig',
        'DevAddr': whereOpts.DevAddr,
      }));
  });
};

module.exports = JoinResHandler;
