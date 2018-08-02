'use strict';

const BluebirdPromise = require('bluebird');
const _ = require('lodash');
const config = require('../../config');
const pubToASTopic = config.msgQueue.topics.pubToApplicationServer;
const pubToCSTopic = config.msgQueue.topics.pubToControllerServer;
const fcntCheckEnable = config.server.fcntCheckEnable;
const consts = require('../lora-lib/constants');
const ERROR = require('../lora-lib/ERROR');
const PubControllerModel = require('./models/pubControllerModel');

function AppDataHandler(mqClient, mysqlConn, log) {
  this.DeviceStatus = mysqlConn.DeviceStatus;
  this.DeviceConfig = mysqlConn.DeviceConfig;
  this.DeviceRouting = mysqlConn.DeviceRouting;
  this.DeviceInfo = mysqlConn.DeviceInfo;
  this.mqClient = mqClient;
  this.log = log;

}

AppDataHandler.prototype.handle = function (rxInfoArr, appObj) {

  let _this = this;
  let optimalRXInfo = rxInfoArr[0];

  //console.log('rxInfoArr',rxInfoArr);
  //console.log('appObj', appObj);

  const uploadDataDevAddr = appObj.MACPayload.FHDR.DevAddr;
  const uplinkFCnt = appObj.MACPayload.FHDR.FCnt;
  let newFCnt;
  if (fcntCheckEnable) {
    const preFCnt = appObj.FCntUp;
    const newUplinkFCntNum = uplinkFCnt.readUInt32BE();
    const mulNum = parseInt(preFCnt / 65536);
    const remainderNum = preFCnt % 65536;

    if (newUplinkFCntNum > remainderNum && newUplinkFCntNum - remainderNum < consts.MAX_FCNT_DIFF) {
      newFCnt = mulNum * 65536 + newUplinkFCntNum;
    } else if (remainderNum > newUplinkFCntNum &&
      newUplinkFCntNum + 65536 - remainderNum < consts.MAX_FCNT_DIFF) {
      newFCnt = (mulNum + 1) * 65536 + newUplinkFCntNum;
    } else if (remainderNum === newUplinkFCntNum) {
      newFCnt = preFCnt;
    } else {
      return BluebirdPromise.reject(new ERROR.InvalidFCntError({
        'message': 'Invalid FCnt',
        'DevAddr': uploadDataDevAddr,
        'PRE_FCont': preFCnt,
        'NEW_FCont': newUplinkFCntNum,
      }));
    }
  } else {
    newFCnt = uplinkFCnt.readUInt32BE();
  }

  function uploadToAS(appObj) {

    const topic = pubToASTopic;
    const message = {
      DevAddr: appObj.MACPayload.FHDR.DevAddr,
      FRMPayload: appObj.MACPayload.FRMPayload,
    };

    return _this.mqClient.publish(topic, message);
  }

  function storeRXInfoToMysql(rxInfoArr) {
    return BluebirdPromise.map(rxInfoArr, function (item) {
      return _this.DeviceStatus.createItem(item);
    });
  }

  function uploadToCS(rxInfoArr, appObj) {
    let macCmdArr = [];
    const fport = appObj.MACPayload.FPort.readInt8();
    const fOptsLen = appObj.MACPayload.FHDR.FCtrl.FOptsLen;
    if (fport  === 0  && appObj.MACPayload.FRMPayload) {
      macCmdArr = appObj.MACPayload.FRMPayload;
    } else if (fOptsLen > 0 && appObj.MACPayload.FHDR.FOpts) {
      macCmdArr = appObj.MACPayload.FHDR.FOpts;
    }

    const adr = appObj.MACPayload.FHDR.FCtrl.ADR;
    let pubControllerModel;
    if (macCmdArr.length > 0) {
      pubControllerModel = new PubControllerModel(rxInfoArr, adr, macCmdArr);
    } else if (adr === 1) {
      pubControllerModel = new PubControllerModel(rxInfoArr, adr);
    } else {
      return BluebirdPromise.resolve();
    }

    const topic = pubToCSTopic;
    const message = {
      DevAddr: pubControllerModel.getDevAddr(),
      data: pubControllerModel.getCMDdata(),
      adr: pubControllerModel.getadr(),
      devtx: pubControllerModel.getdevtx(),
      gwrx: pubControllerModel.getgwrx(),
    };

    _this.log.info({
      label: `Pub to ${topic}`,
      message: message,
    });

    return _this.mqClient.publish(topic, message);
  }

  return BluebirdPromise
    .all([storeRXInfoToMysql(rxInfoArr),
    _this.updateDeviceRouting(optimalRXInfo),
    _this.DeviceInfo.increaseFcntup(uploadDataDevAddr, newFCnt),
    uploadToAS(appObj),
    uploadToCS(rxInfoArr, appObj),
    ]).then(function () {
      return BluebirdPromise.resolve({ rxInfoArr, appObj });
    });
};

AppDataHandler.prototype.updateDeviceRouting = function (deviceStatus) {

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
  return _this.DeviceConfig.readItem(whereOpts).then(function (res) {
    if (res) {
      if (!res.frequencyPlan) {
        return BluebirdPromise.reject(
          new ERROR.DeviceNotExistError({
            'message': 'DevAddr does not exist frequencyPlan in DeviceConfig',
            'DevAddr': whereOpts.DevAddr,
          }));
      }

      if (!res.RX1DRoffset  && res.RX1DRoffset !== 0) {
        return BluebirdPromise.reject(
          new ERROR.DeviceNotExistError({
            'message': 'DevAddr does not exist RX1DRoffset in DeviceConfig',
            'DevAddr': whereOpts.DevAddr,
          }));
      }

      if (!res.RX1Delay && res.RX1Delay !== 0) {
        return BluebirdPromise.reject(
          new ERROR.DeviceNotExistError({
            'message': 'DevAddr does not exist RX1Delay in DeviceConfig',
            'DevAddr': whereOpts.DevAddr,
          }));
      }

      freqPlanOffset = consts.FREQUENCY_PLAN_LIST.findIndex(function (value, index, array) {
        return value === res.frequencyPlan;
      });

      let tmstOffset;
      if (res.RX1Delay === 0) {
        tmstOffset = 1 * 1000 * 1000;
      } else if (res.RX1Delay > 15) {
        return BluebirdPromise.reject(
          new ERROR.DeviceNotExistError({
          'message': 'DevAddr RX1Delay more than 15 in DeviceConfig',
          'DevAddr': whereOpts.DevAddr,
        }));
      } else {
        tmstOffset = res.RX1Delay * 1000 * 1000;
      }

      let updateOpts = {
        DevAddr: Buffer.from(deviceStatus.DevAddr, 'hex'),
        gatewayId: Buffer.from(deviceStatus.gatewayId, 'hex'),
        tmst: deviceStatus.tmst + tmstOffset,
        freq: consts.TXPK_CONFIG.FREQ[freqPlanOffset]
          (freqPlanOffset === consts.PLANOFFSET915 ? deviceStatus.chan : deviceStatus.freq),
        powe: consts.TXPK_CONFIG.POWE[freqPlanOffset],
        datr: getDatr(deviceStatus.datr, res.RX1DRoffset),
        modu: deviceStatus.modu,
        codr: deviceStatus.codr,
      };
      return _this.DeviceRouting.upsertItem(updateOpts);

    }

    return BluebirdPromise.reject(
      new ERROR.DeviceNotExistError({
        'message': 'DevAddr does not exist in DeviceConfig',
        'DevAddr': whereOpts.DevAddr,
      }));
  });
};

module.exports = AppDataHandler;
