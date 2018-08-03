'use strict';

const expect = require('chai').expect;
const BluebirdPromise = require('bluebird');
const DbModels = require('../../../../models');
const DbClient = require('../../../../lib/lora-lib/dbClient');
const consts = require('../../../../lib/lora-lib/constants');
const MqClient = require('../../../../lib/lora-lib/mqClient/kafka');
const DownlinkDataHandler = require('../../../../lib/converter/downlinkDataHandler');
const DataConverter = require('../../../../lib/converter/dataConverter');
const config = require('../../../../config');
const mochaConfig = config.mocha;
const Log = require('../../../../lib/lora-lib/log');
const log = new Log(config.log);
const testConsts = require('../../testConstants');

const testTopic = 'NC-sub';
const options = {
  nsid: 1,
  consumerGroup: {
    options: {
      kafkaHost: 'localhost:9092',
      groupId: `lora-network-server-message-test-in-1`,
      sessionTimeout: 15000,
      protocol: ['roundrobin'],
      fromOffset: 'latest',
    },
    topics: [testTopic],
  },
  client: {
    kafkaHost: 'localhost:9092',
    clientId: `lora-network-server-message-test-out-1`,
  },
  producer: {
    requireAcks: 1,
    ackTimeoutMs: 100,
    partitionerType: 2,
  },
  topics: {
    pubToConnector: 'NC-sub',
    subFromConnector: 'NS-sub',
    pubToJoinServer: 'JS-sub',
    subFromJoinServer: 'JS-pub',
  },
};

describe('Test DownlinkDataHandler', function () {
  let dbModels = new DbModels(DbClient);
  let mysqlConn = dbModels.mysqlConn;
  let _ioredis = dbModels._ioredis;
  let mqClient;
  let dataConverter;
  let downlinkDataHandler;
  let redisConn = dbModels.redisConn.MessageQueue;

  let DeviceStatus = mysqlConn.DeviceStatus;
  let DeviceRouting = mysqlConn.DeviceRouting;
  let DeviceConfig = mysqlConn.DeviceConfig;
  let DeviceInfo = mysqlConn.DeviceInfo;
  let AppInfo = mysqlConn.AppInfo;
  let Developers = mysqlConn.Developers;

  this.timeout(mochaConfig.timeout);
  before('Test Developers & AppInfo & DeviceInfo To createItem a device ', function (done) {
    Developers.createItem(testConsts.testDeveloper)
      .then(function () {
        return AppInfo.createItem(testConsts.testApp);
      })
      .then(function () {
        return DeviceInfo.createItem(testConsts.testDeviceInfo);
      })
      .then(function () {
        return DeviceConfig.createItem(testConsts.testDeviceConfig);
      }).then(function () {
        return DeviceRouting.createItem(testConsts.testDeviceRouting);
      })
      .then(() => { done(); })
      .catch(function (err) {
        console.log(err);
        Developers.removeItem(testConsts.delOpts);
        done(err);
      });
  });

  before('create a consumer of NC-sub topic && a dataConverter && a downlinkDataHandler ',
    function (done) {
      this.timeout(10000);
      mqClient = new MqClient(options, log);

      mqClient.connect().then(function () {
        console.log('mqClient connect, both consumer and producer');
        dataConverter = new DataConverter(mqClient, dbModels.redisConn, dbModels.mysqlConn, log);
        downlinkDataHandler = new DownlinkDataHandler(mqClient,
          dbModels.redisConn, dbModels.mysqlConn, log);

        done();
      }).catch(function (err) {
        console.log('mqClient connect failed : ', err.message);
        done(err);
      });
    });

  describe('Test function appDataDownlink', function (done) {
    this.timeout(10000);

    it('Input a application message to downlink message queue', function (done) {

      const DevAddr = testConsts.testDeviceInfo.DevAddr;
      const msgQueKey = consts.DOWNLINK_MQ_PREFIX + DevAddr.toString('hex');

      _ioredis.rpush(msgQueKey, JSON.stringify(testConsts.downlinkDataMsgQueueInRedis))
        .then(function () {
          done();
        });
    });

    it('Send the application message to Network Connector', function (done) {

      mqClient.message(function (message) {

        // console.log('    received message : ', message);
        expect(message.topic).to.equal(testTopic);
        done();
      });

      downlinkDataHandler.appDataDownlink(testConsts.uplinkAppObj,
        dataConverter.downlinkAppConverter.bind(dataConverter))
        .then(function (res) {
          if (!res) {
            console.log('no downlink data & unconfirmed');
            done(); // no downlink data & unconfirmed
          }

          // done();
        }).catch(function (err) {
          console.log(err);
          done(err);
        });
    });
  });

  it('Test function getMacCmdDownByteLength', function () {

    let testMacCmdArr = [{ '03': {} }, { '02': {} }];
    let keyNum = testMacCmdArr.length;
    let macCmdLength = downlinkDataHandler.getMacCmdDownByteLength(testMacCmdArr);
    expect(macCmdLength).to.equal(keyNum + consts.MACCMD_DOWNLINK_LIST[3] +
      consts.MACCMD_DOWNLINK_LIST[2]);
  });

  it('Test function getMacCmdUpByteLength', function () {

    let testMacCmdArr = [{ '03': {} }, { '02': {} }];
    let keyNum = testMacCmdArr.length;
    let macCmdLength = downlinkDataHandler.getMacCmdUpByteLength(testMacCmdArr);
    expect(macCmdLength).to.equal(keyNum + consts.MACCMD_UPLINK_LIST[3] +
      consts.MACCMD_UPLINK_LIST[2]);
  });

  it('Test function getMaxFRMPayloadAndFOptByteLength', function () {

    let frequencyPlan = 433;
    let datr = 'SF12BW125';
    let repeaterCompatible = false;
    let protocolVersion = '1.0.2';
    let macMaxLength = downlinkDataHandler.getMaxFRMPayloadAndFOptByteLength(frequencyPlan,
      datr, repeaterCompatible, protocolVersion);

    expect(macMaxLength).to.equal(consts.MAX_FRMPAYLOAD_SIZE_NOREPEATER[frequencyPlan][datr]);
  });

  after('Remove the device in the mysql database & Remove the data', function (done) {
    Developers.removeItem(testConsts.delOpts)
      .then(function () {
        done();
      })
      .catch(function (err) {
        console.log(err);
        done(err);
      });
  });

  after('close redis connection', function (done) {
    BluebirdPromise.all([mqClient.disconnect(), dbModels.close()]).then(function () {
      console.log('mqclient & _redis disconnect');
      done();
    });
  });

});
