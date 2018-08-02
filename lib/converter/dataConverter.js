
'use strict';

const utils = require('../lora-lib/utils');
const _ = require('lodash');
const Ajv = require('ajv');
const ajv = new Ajv({ allErrors: true });
let uplinkMessageSchema = require('./schema/uplinkMessage.schema.json');
ajv.addSchema(uplinkMessageSchema, 'uplinkMessageSchema');
const BluebirdPromise = require('bluebird');
const GatewayStatHandler = require('./gatewayStatHandler');
const DeDuplication = require('./deDuplication');
const AppDataHandler = require('./appDataHandler');
const DownlinkDataHandler = require('./downlinkDataHandler');
const JoinResHandler = require('./joinResHandler');
const consts = require('../lora-lib/constants');
const crypto = require('crypto');
const ERROR = require('../lora-lib/ERROR');

let gw = [];
let dev = [];

function DataConverter(mqClient, redisConn, mysqlConn, log) {
  this.deDuplication = new DeDuplication(redisConn.DeDuplication);
  this.gatewayStatHandler = new GatewayStatHandler(mysqlConn.GatewayStatus);
  this.DeviceInfo = mysqlConn.DeviceInfo;
  this.GatewayInfo = mysqlConn.GatewayInfo;
  this.appDataHandler = new AppDataHandler(mqClient, mysqlConn, log);
  this.mqClient = mqClient;
  this.downlinkDataHandler = new DownlinkDataHandler(mqClient, redisConn, mysqlConn, log);
  this.joinResHandler = new JoinResHandler(mqClient, redisConn, mysqlConn, log);
  this.log = log;

}

function errHandler(err) {

  //TODO add error handle
}

DataConverter.prototype.gatewayStatConverter = function (uplinkDataJson) {

  let gatewayStatObject = {};

  gatewayStatObject = uplinkDataJson.stat;
  gatewayStatObject.gatewayId = uplinkDataJson.gatewayId;

  return gatewayStatObject;
};

DataConverter.prototype.rxInfoConverter = function (uplinkDataJson) {

  let rfPacketObject = {};
  _.forEach(uplinkDataJson.rxpk, function (data, key) {
    if (key !== 'data' && key !== 'raw') {
      rfPacketObject[key] = data;
    }
  });

  rfPacketObject.gatewayId = uplinkDataJson.gatewayId;
  rfPacketObject.DevAddr = uplinkDataJson.rxpk.data.MACPayload.FHDR.DevAddr;

  return rfPacketObject;
};

DataConverter.prototype.joinRfConverter = function (joinDataJson) {

  let rfPacketObject = {};
  _.forEach(joinDataJson.rxpk, function (data, key) {
    if (key !== 'data' && key !== 'raw') {
      rfPacketObject[key] = data;
    }
  });

  rfPacketObject.gatewayId = joinDataJson.gatewayId;
  rfPacketObject.DevAddr = joinDataJson.rxpk.data.DevAddr;

  return rfPacketObject;
};

DataConverter.prototype.appDataConverter = function (uplinkDataJson) {
  let _this = this;

  let appDataObject = uplinkDataJson.rxpk.data;
  appDataObject.version = uplinkDataJson.version;
  appDataObject.srcID = uplinkDataJson.srcID ? uplinkDataJson.srcID : '';

  let appFRMPayloadBuf = appDataObject.MACPayload.FRMPayload;
  if (appFRMPayloadBuf) {
    const whereOpts = {
      DevAddr: appDataObject.MACPayload.FHDR.DevAddr,
    };

    return _this.DeviceInfo.readItem(whereOpts, ['did', 'FCntUp'])
      .then(function (res) {

        // console.log('<-----------------DID----------------->');
        // console.log(res.did);
        // console.log('<-----------------PRODUCTKEY----------------->');
        // console.log(res.productKey);
        if (!_.isEmpty(res.did)) {
          appDataObject.did = res.did;
          appDataObject.FCntUp = res.FCntUp;
          return BluebirdPromise.resolve(appDataObject);
        }

        // console.log('<-----------------THE DEVADDR HAS NO PRODUCTKEY----------------->');
        return BluebirdPromise.reject(
          new ERROR.DeviceNotExistError({
            'message': 'DevAddr does not exist in DeviceInfo',
            'DevAddr': whereOpts.DevAddr.toString('hex'),
          }));
      });
  }

  // _this.log.debug({
  //   label: 'The uplink data has no {MACPayload.FRMPayload}',
  //   message: appDataObject,
  // });

  return BluebirdPromise.reject('The uplink data has no {MACPayload.FRMPayload}');
};

DataConverter.prototype.uplinkDataHandler = function (jsonData) {
  let _this = this;
  let valid = ajv.validate('uplinkMessageSchema', jsonData);
  if (!valid) {

    //TODO
    // console.log(ajv.errorsText());
    return BluebirdPromise.reject(
      new ERROR.JsonSchemaError('UplinkMsg Schema : ' + ajv.errorsText()));
  }

  const uplinkDataJson = jsonData;
  const uplinkDataId = Buffer.from(jsonData.identifier);

  const uplinkGatewayId = Buffer.from(jsonData.gatewayId);
  const whereOpts = {
    gatewayId: uplinkGatewayId,
  };
  return _this.GatewayInfo.readItem(whereOpts).then(function (res) {
    if (_.isEmpty(res)) {
      return BluebirdPromise.reject(
        new ERROR.DeviceNotExistError({
          'message': 'The gatewayId is not registered',
          'gatewayId': whereOpts.gatewayId,
        }));
    } else {
      if (uplinkDataId.equals(Buffer.from([consts.UDP_ID_PUSH_DATA]))) {

        if (uplinkDataJson.hasOwnProperty('rxpk')) {

          if (!uplinkDataJson.rxpk.hasOwnProperty('data')) {
            return BluebirdPromise.reject(new Error('Uplink Json has no "data" in rxpk'));
          }

          const messageType = uplinkDataJson.rxpk.data.MHDR.MType;

          if (messageType === consts.JS_MSG_TYPE.request) {

            const joinReqJson = Object.assign({}, uplinkDataJson);
            const rawData = uplinkDataJson.rxpk.raw;
            const getewayId = uplinkDataJson.gatewayId;

            return _this.deDuplication.handle(joinReqJson)
              .then(function (resArr) {
                if (resArr) {
                  return _this.joinResHandler.joinRequestHandle(resArr);
                }

                _this.log.debug({
                  label: 'Receive repeated join request message',
                  message: uplinkDataJson,
                });

                //TODO update downlink routing
                return BluebirdPromise.resolve(true);
              });
          }

          if (messageType === consts.UNCONFIRMED_DATA_UP ||
            messageType === consts.CONFIRMED_DATA_UP) {

            return _this.deDuplication.handle(uplinkDataJson)
              .then(function (resArr) {
                if (resArr) {
                  let rxInfoArr = [];
                  resArr.forEach(function (element, index) {
                    rxInfoArr.push(_this.rxInfoConverter(element));
                  });

                  // const rfAppData = _this.rfDataConverter(resArr[0]);

                  return _this.appDataConverter(resArr[0])
                    .then(function (appObj) {
                      return _this.appDataHandler.handle(rxInfoArr, appObj);
                    });
                }

                _this.log.debug({
                  label: 'Receive repeated app data message',
                  message: uplinkDataJson,
                });
                return BluebirdPromise.resolve(null);
              })
              .then(function (res) {
                if (res && res.appObj) {

                  let uplinkInfo = res.appObj;
                  return _this.downlinkDataHandler.appDataDownlink(uplinkInfo,
                    _this.downlinkAppConverter.bind(_this));
                }

                return BluebirdPromise.resolve(true);
              });
          }

        } else if (uplinkDataJson.hasOwnProperty('stat')) {

          const gatawaySata = _this.gatewayStatConverter(uplinkDataJson);

          return _this.gatewayStatHandler.handle(gatawaySata)
            .then(function () {

              return BluebirdPromise.resolve('Update GatewayStatus Success');
            });
        } else {
          return BluebirdPromise.reject(
            new ERROR.MsgTypeError('Error key value of received JSON (NO "rxpk" or "stat")'));
        }
      } else if (uplinkDataId.equals(Buffer.from([consts.UDP_ID_PULL_DATA]))) {

        //TODO
        // _this.log.debug('Recive UDP Pull Data');
        return BluebirdPromise.resolve('Recive UDP Pull Data');
      } else if (uplinkDataId.equals(Buffer.from([consts.UDP_ID_TX_ACK]))) {

        //TODO
        // _this.log.debug('Recive UDP TX_ACK');
        return BluebirdPromise.resolve('Recive UDP TX_ACK');
      } else {
        return BluebirdPromise.reject(
          new ERROR.MsgTypeError({
            'message': 'Error UDP package identifier',
            'Identifier': uplinkDataId,
          }));
      }
    }
  });
};

DataConverter.prototype.downlinkAppConverter = function (txJson, downlinkJson, uplinkInfo) {
  let _this = this;
  const outputObject = {};
  outputObject.version = uplinkInfo.version;
  if (uplinkInfo.srcID && uplinkInfo.srcID.length > 0) {
    outputObject.dstID = uplinkInfo.srcID;
  }

  outputObject.token = crypto.randomBytes(consts.UDP_TOKEN_LEN);
  outputObject.identifier = Buffer.alloc(consts.UDP_IDENTIFIER_LEN);
  outputObject.identifier.writeUInt8(consts.UDP_ID_PULL_RESP, 'hex');
  outputObject.gatewayId = txJson.gatewayId;

  const whereOpts = {
    did: uplinkInfo.did,
  };

  function generateTxpkJson() {
    let tempdata = {};
    let MHDRJson = {};
    let MACPayloadJson = {};
    let FHDRJson = {};
    let FCtrlJson = {};
    const messageType = uplinkInfo.MHDR.MType;

    if (messageType === consts.CONFIRMED_DATA_UP) {
      MHDRJson.MType = consts.CONFIRMED_DATA_DOWN;
      FCtrlJson.ACK = 1;
    }

    if (messageType === consts.UNCONFIRMED_DATA_UP) {
      MHDRJson.MType = consts.UNCONFIRMED_DATA_DOWN;
      FCtrlJson.ACK = 0;
    }

    MHDRJson.Major = uplinkInfo.MHDR.Major;
    tempdata.MHDR = MHDRJson;

    if (txJson.DeviceConfig.ADR || txJson.DeviceConfig.ADR === false) {
      FCtrlJson.ADR = txJson.DeviceConfig.ADR;
    } else {
      FCtrlJson.ADR = uplinkInfo.MACPayload.FHDR.FCtrl.ADR;
    }

    FCtrlJson.FPending = downlinkJson.FPending ? downlinkJson.FPending : 0;
    FCtrlJson.FOptsLen = downlinkJson.FOptsLen ? downlinkJson.FOptsLen : 0;

    FHDRJson.DevAddr = uplinkInfo.MACPayload.FHDR.DevAddr;
    FHDRJson.FCtrl = FCtrlJson;
    FHDRJson.FCnt = Buffer.alloc(consts.FCNT_LEN);
    FHDRJson.FCnt.writeUInt32BE(txJson.DeviceInfo.AFCntDown);

    FHDRJson.FOpts = downlinkJson.FOpts ? downlinkJson.FOpts : [];

    MACPayloadJson.FHDR = FHDRJson;

    if (downlinkJson.isMacCmdInFRM && downlinkJson.FRMPayload.length > 0) {
      MACPayloadJson.FPort = consts.MACCOMMANDPORT;
      MACPayloadJson.FRMPayload = downlinkJson.FRMPayload;
    } else if (downlinkJson.FRMPayload.length > 0) {
      MACPayloadJson.FPort = uplinkInfo.MACPayload.FPort;
      MACPayloadJson.FRMPayload = downlinkJson.FRMPayload;
    } else {
      MACPayloadJson.FPort = uplinkInfo.MACPayload.FPort;
    }

    tempdata.MACPayload = MACPayloadJson;

    return {
      imme: txJson.imme,
      tmst: txJson.tmst,
      freq: txJson.freq,
      rfch: txJson.rfch,
      powe: txJson.powe,
      datr: txJson.datr,
      modu: txJson.modu,
      codr: txJson.codr,
      ipol: txJson.ipol,
      data: tempdata,
    };
  }

  outputObject.txpk = generateTxpkJson();

  return BluebirdPromise.resolve(outputObject);
};

DataConverter.prototype.joinAcceptHandler = function (joinAcceptJson) {

  let _this = this;
  const joinAcceptObj = Object.assign({}, joinAcceptJson);
  const joinRfData = _this.joinRfConverter(joinAcceptObj);

  // return _this.joinResHandler.updateDeviceConfig(joinAcceptObj)
  //   .then(function () {
  //     let DevAddr = joinAcceptObj.rxpk.data.DevAddr;
  //     return _this.joinResHandler.addDevShadowSubTopics(DevAddr);
  //   })
  //   .then(function () {
  //     return _this.appDataHandler.handle(joinRfData);
  //   })
  //   .then(function () {
  // return _this.downlinkDataHandler
  // .joinAcceptDownlink(joinAcceptObj, _this.joinAcceptConverter);
  //   });

  return _this.joinResHandler
    .handler(joinRfData)
    .then(function () {
      return _this.downlinkDataHandler.joinAcceptDownlink(joinAcceptObj, _this.joinAcceptConverter);
    });
};

DataConverter.prototype.joinAcceptConverter = function (rfJson, joinReqJson) {

  const outputObject = {};
  outputObject.version = joinReqJson.version;
  outputObject.token = crypto.randomBytes(consts.UDP_TOKEN_LEN);
  outputObject.identifier = Buffer.alloc(consts.UDP_IDENTIFIER_LEN);
  outputObject.identifier.writeUInt8(consts.UDP_ID_PULL_RESP, 'hex');
  outputObject.gatewayId = rfJson.gatewayId;

  function generateTxpkJson() {
    return {
      imme: rfJson.imme,
      tmst: rfJson.tmst,
      freq: rfJson.freq,
      rfch: rfJson.rfch,
      powe: rfJson.powe,
      datr: rfJson.datr,
      modu: rfJson.modu,
      codr: rfJson.codr,
      ipol: rfJson.ipol,
      data: joinReqJson.rxpk.data,
    };
  }

  outputObject.txpk = generateTxpkJson();

  return outputObject;
};

module.exports = DataConverter;
