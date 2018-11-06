
'use strict';

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
const crypto = require('crypto');
const loraLib = require('../lora-lib');
const { consts, ERROR, utils } = loraLib;
const moment = require('moment');
const mongoose = require('mongoose');
const mongoSavedSchema = require('./schema/mongoSavedMsg');

function DataConverter(mqClient, redisConn, mysqlConn, log) {
  this.deDuplication = new DeDuplication(redisConn.DeDuplication);
  this.gatewayStatHandler = new GatewayStatHandler(mysqlConn.GatewayStatus);
  this.deviceInfo = redisConn.DeviceInfo;
  this.DeviceInfo = mysqlConn.DeviceInfo;
  this.GatewayInfo = mysqlConn.GatewayInfo;
  this.appDataHandler = new AppDataHandler(mqClient, redisConn, mysqlConn, log);
  this.mqClient = mqClient;
  this.downlinkDataHandler = new DownlinkDataHandler(mqClient, redisConn, mysqlConn, log);
  this.joinResHandler = new JoinResHandler(mqClient, redisConn, mysqlConn, log);
  this.log = log;

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
    // const whereOpts = {
    //   DevAddr: appDataObject.MACPayload.FHDR.DevAddr,
    // };

    return _this.deviceInfo.read(appDataObject.MACPayload.FHDR.DevAddr, ['FCntUp', 'AppEUI'])
      // return _this.DeviceInfo.readItem(whereOpts, ['FCntUp', 'AppEUI'])
      .then(function (res) {

        if (!utils.isEmptyValue(res.FCntUp)) {
          appDataObject.FCntUp = res.FCntUp;
          appDataObject.AppEUI = res.AppEUI;
          return BluebirdPromise.resolve(appDataObject);
        }

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
  const uplinkDataId = Buffer.from(jsonData.identifier, 'hex');

  if (uplinkDataId.equals(Buffer.from([consts.UDP_ID_PUSH_DATA]))) {

    //Recive PUSH data
    if (uplinkDataJson.hasOwnProperty('rxpk')) {

      //Recive PUSH data from Node
      if (!uplinkDataJson.rxpk.hasOwnProperty('data')) {
        return BluebirdPromise.reject(new Error('Uplink Json has no "data" in rxpk'));
      }

      const messageType = uplinkDataJson.rxpk.data.MHDR.MType;

      if (messageType === consts.JS_MSG_TYPE.request) {

        //Join request message
        const joinReqJson = Object.assign({}, uplinkDataJson);

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
          }).then(function () {

            const collectionName = consts.MONGO_JOINMSGCOLLECTION;
            const mongoSavedObj = {
              msgType: consts.MONGO_SAVEDMSG_TYPE.uplink_joinReq,
              createdTime: moment().unix(),
              data: uplinkDataJson,
            };

            return _this.mongooseSave(collectionName, mongoSavedObj);
          });
      }

      if (messageType === consts.UNCONFIRMED_DATA_UP ||
        messageType === consts.CONFIRMED_DATA_UP) {

        //Application message
        return _this.deDuplication.handle(uplinkDataJson)
          .then(function (resArr) {
            if (resArr) {
              let rxInfoArr = [];
              resArr.forEach(function (element) {
                rxInfoArr.push(_this.rxInfoConverter(element));
              });

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
          .then(function (uplinkInfo) {   //FIXME
            const devAddr = uplinkDataJson.rxpk.data.MACPayload.FHDR.DevAddr;
            if (uplinkInfo && uplinkInfo.appObj) {
              const appEUIStr = uplinkInfo.appObj.AppEUI.toString('hex');
              const collectionName = consts.MONGO_APPMSGCOLLECTION_PREFIX + appEUIStr;
              const mongoSavedObj = {
                DevAddr: devAddr,
                msgType: consts.MONGO_SAVEDMSG_TYPE.uplink_msg,
                createdTime: moment().unix(),
                data: uplinkDataJson,
              };

              return _this.mongooseSave(collectionName, mongoSavedObj).then(function () {
                return BluebirdPromise.resolve(uplinkInfo);
              });
            } else {
              // const whereOpts = {
              //   DevAddr: devAddr,
              // };
              // return _this.DeviceInfo.readItem(whereOpts).then((res) => {
              return _this.deviceInfo.read(devAddr, [AppEUI]).then((res) => {
                const collectionName = consts.MONGO_APPMSGCOLLECTION_PREFIX + res.AppEUI;
                const mongoSavedObj = {
                  DevAddr: devAddr,
                  msgType: consts.MONGO_SAVEDMSG_TYPE.uplink_msg,
                  createdTime: moment().unix(),
                  data: uplinkDataJson,
                };

                return _this.mongooseSave(collectionName, mongoSavedObj).then(function () {
                  return BluebirdPromise.resolve(null);
                });
              });
            }
          })
          .then(function (uplinkInfo) {
            if (uplinkInfo && uplinkInfo.appObj) {

              let uplinkInfoAppObj = uplinkInfo.appObj;
              const appEUIStr = uplinkInfoAppObj.AppEUI.toString('hex');
              return _this.downlinkDataHandler.appDataDownlink(uplinkInfoAppObj,
                _this.downlinkAppConverter.bind(_this))
                .then(function (pubData) {
                  const collectionName = consts.MONGO_APPMSGCOLLECTION_PREFIX + appEUIStr;
                  const devAddr = pubData.txpk.data.MACPayload.FHDR.DevAddr;
                  const mongoSavedObj = {
                    DevAddr: devAddr,
                    msgType: consts.MONGO_SAVEDMSG_TYPE.downlink_msg,
                    createdTime: moment().unix(),
                    data: pubData,
                  };
                  return _this.mongooseSave(collectionName, mongoSavedObj);
                });
            }

            return BluebirdPromise.resolve(true);
          });
      }

    } else if (uplinkDataJson.hasOwnProperty('stat')) {

      //Recive PUSH data from Gateway
      const gatawaySata = _this.gatewayStatConverter(uplinkDataJson);

      return _this.gatewayStatHandler.handle(gatawaySata)
        .then(function () {
          const whereOpts = {
            gatewayId: uplinkDataJson.gatewayId,
          };
          return _this.GatewayInfo.readItem(whereOpts).then((res) => {

            const collectionName = consts.MONGO_USERCOLLECTION_PREFIX + res.userID;
            const mongoSavedObj = {
              msgType: consts.MONGO_SAVEDMSG_TYPE.uplink_gatewayStat,
              createdTime: moment().unix(),
              gatewayId: uplinkDataJson.gatewayId,
              data: uplinkDataJson,
            };

            return _this.mongooseSave(collectionName, mongoSavedObj);
          });
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

    // if (txJson.DeviceConfig.ADR || txJson.DeviceConfig.ADR === false) {
    //   FCtrlJson.ADR = txJson.DeviceConfig.ADR;
    if (txJson.ADR || txJson.ADR === false) {
      FCtrlJson.ADR = txJson.ADR;
    } else {
      FCtrlJson.ADR = uplinkInfo.MACPayload.FHDR.FCtrl.ADR;
    }

    FCtrlJson.FPending = downlinkJson.FPending ? downlinkJson.FPending : 0;
    FCtrlJson.FOptsLen = downlinkJson.FOptsLen ? downlinkJson.FOptsLen : 0;

    FHDRJson.DevAddr = uplinkInfo.MACPayload.FHDR.DevAddr;
    FHDRJson.FCtrl = FCtrlJson;
    FHDRJson.FCnt = Buffer.alloc(consts.FCNT_LEN);
    // FHDRJson.FCnt.writeUInt32BE(txJson.DeviceInfo.AFCntDown);
    FHDRJson.FCnt.writeUInt32BE(txJson.AFCntDown);

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

  return _this.joinResHandler
    .handler(joinRfData)
    .then(function () {
      return _this.downlinkDataHandler.joinAcceptDownlink(joinAcceptObj, _this.joinAcceptConverter);
    }).then(function (pubData) {
      const collectionName = consts.MONGO_JOINMSGCOLLECTION;
      const mongoSavedObj = {
        msgType: consts.MONGO_SAVEDMSG_TYPE.downlink_joinAns,
        createdTime: moment().unix(),
        data: pubData,
      };
      return _this.mongooseSave(collectionName, mongoSavedObj);
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

DataConverter.prototype.mongooseSave = function (collectionName, mongoSavedObj) {

  //The message is saved in mongo db
  let msgModel;

  switch (collectionName) {

    //TODO
    default:
      break;
  }

  try {
    msgModel = mongoose.model(collectionName);
  } catch (err) {
    msgModel = mongoose.model(collectionName, mongoSavedSchema, collectionName);
  }

  return msgModel.create(mongoSavedObj);
};
module.exports = DataConverter;
