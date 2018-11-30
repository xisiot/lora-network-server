'use strict';

const BluebirdPromise = require('bluebird');
const consts = require('../lora-lib/constants');
const config = require('../../config');
const pubNCTopic = config.mqClient_ns.topics.pubToConnector;

function DownlinkDataHandler(mqClient, redisConn, mysqlConn, log, options) {
  let _this = this;

  /* properties */
  this.options = options || {};

  this.redisConnMsgQue = redisConn.MessageQueue;
  this.redisConnMacCmdQue = redisConn.MacCmdQueue;
  this.deviceInfo = redisConn.DeviceInfo;
  this.mysqlConn = mysqlConn;
  this.mqClient = mqClient;
  this.log = log;

}

DownlinkDataHandler.prototype.appDataDownlink = function (uplinkData, convertFn) {

  let _this = this;

  // console.log('<-------uplinkData Info------------>');
  // console.log(uplinkData);
  let uplinkInfo = uplinkData;

  let DevAddr = uplinkInfo.MACPayload.FHDR.DevAddr;

  let generateDownlink = function (txJson, downlinkJson) {

    return convertFn(txJson, downlinkJson, uplinkInfo)
      .then(function (dlkObj) {
        if (!dlkObj) {
          return BluebirdPromise.reject(new Error('Generate downlink object failed'));
        }

        _this.log.info({
          label: `Downlink object to ${pubNCTopic}`,
          message: dlkObj,
        });

        // console.log('<-------Downlink Object------------>');
        // console.log(dlkObj);

        // publish schema-valid downlink data to NC-sub
        return _this.mqClient.publish(pubNCTopic, dlkObj)
          .then(function (res) {

            // TODO : increaseNfcntdown (for MAC Command)
            return _this.deviceInfo.increaseAfcntdown(DevAddr);
            // return _this.mysqlConn.DeviceInfo.increaseAfcntdown(DevAddr);
          }).then(function () {
            return BluebirdPromise.resolve(dlkObj);
          });
      });

  };

  let downlinkDataHandler = function (resolve, reject) {

    const macCmdQueAnsKey = consts.MACCMDQUEANS_PREFIX + DevAddr.toString('hex');
    const macCmdQueReqKey = consts.MACCMDQUEREQ_PREFIX + DevAddr.toString('hex');
    const msgQueKey = consts.DOWNLINK_MQ_PREFIX + DevAddr.toString('hex');

    let downlinkJson = {
      FPending: 0,
      FOptsLen: 0,
      FOpts: [],
      FRMPayload: [],
      isMacCmdInFRM: false,
      ackbit: 0,
    };

    const messageType = uplinkInfo.MHDR.MType;
    const messageFPort = uplinkInfo.MACPayload.FPort;

    if (messageType === consts.CONFIRMED_DATA_UP) {
      downlinkJson.ackbit = 1;
    }

    //Get txpk config from db
    // return _this.mysqlConn.getTxpkInfo(DevAddr).then(function (txJson) {
    return _this.deviceInfo.read(DevAddr).then(function (txJson) {

      // const frequencyPlan = txJson.DeviceConfig.frequencyPlan;
      const frequencyPlan = txJson.frequencyPlan;
      const downlinkDatr = txJson.datr;
      const repeaterCompatible = false;
      // const protocolVersion = txJson.DeviceInfo.ProtocolVersion;
      const protocolVersion = txJson.ProtocolVersion;
      const maxFRMPayloadAndFOptSize = _this.getMaxFRMPayloadAndFOptByteLength(frequencyPlan,
        txJson.datr, repeaterCompatible, protocolVersion);

      if (maxFRMPayloadAndFOptSize === 0) {
        return BluebirdPromise.reject(new Error(JSON.stringify({
          message: 'Get max FRMPayload & FOpt Byte Length Error',
          DevAddr: DevAddr,
          frequencyPlan: frequencyPlan,
          downlinkDatr: downlinkDatr,
        })));
      }

      //Consume mac cmd answer queue
      return _this.redisConnMacCmdQue.consumeAll(macCmdQueAnsKey).then(function (cmdAnsArr) {

        //Mac cmd answer queue has data
        if (cmdAnsArr && cmdAnsArr.length > 0) {
          downlinkJson.ackbit = 1;
          let macCmdDownLen = _this.getMacCmdDownByteLength(cmdAnsArr);

          if (macCmdDownLen > consts.FOPTS_MAXLEN) {
            downlinkJson.isMacCmdInFRM = true;
            downlinkJson.FRMPayload = cmdAnsArr.concat([]);

            let remainSize = maxFRMPayloadAndFOptSize - macCmdDownLen;

            if (remainSize < 0) {
              return BluebirdPromise.reject(new Error(JSON.stringify({
                message: 'RemainSize less than 0',
                DevAddr: DevAddr,
                macCmdAns: cmdAnsArr,
                macCmdDownLen: macCmdDownLen,
                maxSize: maxFRMPayloadAndFOptSize,
              })));
            }

            return _this.redisConnMacCmdQue.read(macCmdQueReqKey).then(function (cmdReqArr) {
              if (cmdReqArr && cmdReqArr.length > 0) {
                for (let i = 0; i < cmdReqArr.length; i++) {

                  let macByteLen = 0;
                  for (let key in cmdReqArr[i]) {
                    let cid = parseInt(key, 16);
                    if (cid in consts.MACCMD_DOWNLINK_LIST) {
                      macByteLen = macByteLen + consts.CID_LEN + consts.MACCMD_DOWNLINK_LIST[cid];
                    }
                  }

                  remainSize = remainSize - macByteLen;
                  if (remainSize >= 0) {
                    downlinkJson.FRMPayload.push(cmdReqArr[i]);
                  } else {
                    if (i < cmdReqArr.length - 1) {
                      downlinkJson.FPending = 1;
                    }

                    break;
                  }
                }
              }

              return _this.redisConnMsgQue.checkQueueLength(msgQueKey);
            }).then(function (res) {
              if (res && res > 0) {
                downlinkJson.FPending = 1;
              }
            }).then(function () {
              return generateDownlink(txJson, downlinkJson);
            }).then(function (res) {
              return resolve(res);
            });

          } else if (macCmdDownLen <= consts.FOPTS_MAXLEN) {
            downlinkJson.FOptsLen = macCmdDownLen;
            downlinkJson.FOpts = cmdAnsArr.concat([]);

            return _this.redisConnMacCmdQue.read(macCmdQueReqKey)
              .then(function (cmdReqArr) {
                if (cmdReqArr && cmdReqArr.length > 0) {
                  for (let i = 0; i < cmdReqArr.length; i++) {
                    let macByteLen = 0;
                    for (let key in cmdReqArr[i]) {
                      let cid = parseInt(key, 16);
                      if (cid in consts.MACCMD_DOWNLINK_LIST) {
                        macByteLen = macByteLen + consts.CID_LEN + consts.MACCMD_DOWNLINK_LIST[cid];
                      }
                    }

                    if (macByteLen + downlinkJson.FOptsLen <= consts.FOPTS_MAXLEN) {
                      downlinkJson.FOptsLen = macByteLen + downlinkJson.FOptsLen;
                      downlinkJson.FOpts.push(cmdReqArr[i]);
                    } else {
                      if (i < cmdReqArr.length - 1) {
                        downlinkJson.FPending = 1;
                      }

                      break;
                    }
                  }
                }

                return _this.redisConnMsgQue.consume(msgQueKey);
              }).then(function (res) {

                if (res && res.hasOwnProperty('pbdata')) {
                  downlinkJson.FRMPayload = Buffer.from(res.pbdata, 'hex');
                }

                if (downlinkJson.FRMPayload.length > maxFRMPayloadAndFOptSize) {
                  return BluebirdPromise.reject(new Error(JSON.stringify({
                    message: 'App data Length exceeds the maximum length in FRMPayload',
                    DevAddr: DevAddr,
                    maxFRMPayloadAndFOptSize: maxFRMPayloadAndFOptSize,
                    appDataLength: downlinkJson.FRMPayload.length,
                  })));
                }

                return generateDownlink(txJson, downlinkJson).then(function (res) {
                  return resolve(res);
                });
              });
          }
        }

        //Mac cmd answer queue has NO data
        //Read Mac cmd request queue
        return _this.redisConnMacCmdQue.read(macCmdQueReqKey).then(function (cmdReqArr) {

          //Mac cmd request queue has data
          if (cmdReqArr && cmdReqArr.length > 0) {
            downlinkJson.ackbit = 1;
            let macCmdDownLen = _this.getMacCmdDownByteLength(cmdReqArr);
            if (macCmdDownLen > consts.FOPTS_MAXLEN) {
              let macCmdDownLen = _this.getMacCmdDownByteLength(cmdReqArr);

              downlinkJson.isMacCmdInFRM = true;
              downlinkJson.FRMPayload = cmdReqArr.concat([]);

              if (macCmdDownLen > maxFRMPayloadAndFOptSize) {
                return _this.redisConnMacCmdQue.consumeAll(macCmdQueReqKey).then(res =>
                  BluebirdPromise.reject(new Error(JSON.stringify({
                    message: 'MAC commands request Length exceeds the maximum length ' +
                      'in FRMPayload && delete reqest queue',
                    DevAddr: DevAddr,
                    maxFRMPayloadAndFOptSize: maxFRMPayloadAndFOptSize,
                    macReqLength: downlinkJson.FRMPayload.length,
                  })))
                );
              }

              return _this.redisConnMsgQue.checkQueueLength(msgQueKey).then(function (res) {
                if (res && res > 0) {
                  downlinkJson.FPending = 1;
                }
              }).then(function () {
                return generateDownlink(txJson, downlinkJson);
              }).then(function (res) {
                return resolve(res);
              });
            } else if (macCmdDownLen <= consts.FOPTS_MAXLEN) {
              downlinkJson.FOptsLen = macCmdDownLen;
              downlinkJson.FOpts = cmdReqArr.concat([]);
            }
          }

          //Mac cmd request queue has data || Mac cmd request queue length <= FOPTS_MAXLEN
          return _this.redisConnMsgQue.consume(msgQueKey)
            .then(function (res) {

              if (!res && !downlinkJson.ackbit) {
                _this.log.debug('The message has no downlink object:');
                return resolve(null);
              }

              if (res && res.hasOwnProperty('pbdata')) {
                downlinkJson.FRMPayload = Buffer.from(res.pbdata, 'hex');
              }

              if (downlinkJson.FRMPayload.length > maxFRMPayloadAndFOptSize) {
                return BluebirdPromise.reject(new Error(JSON.stringify({
                  message: 'App data Length exceeds the maximum length in FRMPayload',
                  DevAddr: DevAddr,
                  maxFRMPayloadAndFOptSize: maxFRMPayloadAndFOptSize,
                  appDataLength: downlinkJson.FRMPayload.length,
                })));
              }

              return generateDownlink(txJson, downlinkJson).then(function (res) {
                return resolve(res);
              });
            });
        });

      }).catch(function (err) {
        return reject(err);
      });
    });
  };

  // delay 500 ms
  let promiseReturn = new BluebirdPromise(function (resolve, reject) {
    setTimeout(downlinkDataHandler, config.server.downlink_Data_Delay, resolve, reject);
  });

  return promiseReturn.then(function (downlinkData) {

    //Persist Redis data to Mysql
    return _this.deviceInfo.read(DevAddr).then(function (res) {
      if (!res) {
        return BluebirdPromise.reject(new Error(JSON.stringify({
          message: 'Failed to persist Redis data to Mysql. No data in Redis',
          DevAddr: DevAddr,
        })));
      }

      if (downlinkData) {
        const persistDataToDeviceInfo = {
          FCntUp : res.FCntUp,
          AFCntDown : res.AFCntDown,
          NFCntDown : res.NFCntDown,
        };

        const persistDataToDeviceRouting = {
          DevAddr : DevAddr,
          gatewayId : res.gatewayId,
          imme : res.imme,
          tmst : res.tmst,
          freq : res.freq,
          powe : res.powe,
          datr : res.datr,
          modu : res.modu,
          codr : res.codr,
        };

        return _this.mysqlConn.DeviceInfo.updateItem({ DevAddr: DevAddr }, persistDataToDeviceInfo);
          // then(function () {
          //   return _this.mysqlConn.DeviceRouting.upsertItem(persistDataToDeviceRouting);
          // });
      } else {
        const persistDataToDeviceInfo = {
          FCntUp : res.FCntUp,
        };
        return _this.mysqlConn.DeviceInfo.updateItem({ DevAddr: DevAddr }, persistDataToDeviceInfo);
      }
    }).then(function () {
      return BluebirdPromise.resolve(downlinkData);
    });
  });
};

DownlinkDataHandler.prototype.joinAcceptDownlink = function (joinAcceptJson, convertFn) {
  let _this = this;

  const DevAddr = joinAcceptJson.rxpk.data.DevAddr;

  // return _this.mysqlConn.getTxpkInfo(DevAddr).then(function (res) {
  return _this.deviceInfo.read(DevAddr).then(function (res) {
    if (!res) {
      return BluebirdPromise.reject(new Error('get txpk config from db failed.'));
    }

    //TODO
    let dlkObj = convertFn(res, joinAcceptJson);
    _this.log.debug({
      label: `Downlink object(JoinAccept) to ${pubNCTopic}`,
      message: dlkObj,
    });
    return _this.mqClient.publish(pubNCTopic, dlkObj).then(function () {
      return BluebirdPromise.resolve(dlkObj);
    });
  });
};

DownlinkDataHandler.prototype.getMacCmdDownByteLength = function (macCmdArr) {
  let _this = this;
  let macByteLen = 0;
  macCmdArr.forEach(element => {
    let cid;
    for (let key in element) {
      cid = parseInt(key, 16);
    }

    if (cid in consts.MACCMD_DOWNLINK_LIST) {
      macByteLen = macByteLen + consts.CID_LEN + consts.MACCMD_DOWNLINK_LIST[cid];
    }
  });
  return macByteLen;
};

DownlinkDataHandler.prototype.getMacCmdUpByteLength = function (macCmdArr) {
  let _this = this;
  let macByteLen = 0;
  macCmdArr.forEach(element => {
    let cid;
    for (let key in element) {
      cid = parseInt(key, 16);
    }

    if (cid in consts.MACCMD_UPLINK_LIST) {
      macByteLen = macByteLen + consts.CID_LEN + consts.MACCMD_UPLINK_LIST[cid];
    }
  });
  return macByteLen;
};

DownlinkDataHandler.prototype.getMaxFRMPayloadAndFOptByteLength = function (frequencyPlan, datr,
  repeaterCompatible, protocolVersion) {
  let _this = this;
  let maxByteLen = 0;

  //TODO Add protocolVersion Check
  if (repeaterCompatible === false) {
    maxByteLen = consts.MAX_FRMPAYLOAD_SIZE_NOREPEATER[frequencyPlan][datr];
  } else {
    maxByteLen = consts.MAX_FRMPAYLOAD_SIZE_REPEATER[frequencyPlan][datr];
  }

  return maxByteLen;
};

module.exports = DownlinkDataHandler;
