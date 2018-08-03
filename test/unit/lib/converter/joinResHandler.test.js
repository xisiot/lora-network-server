'use strict';

const expect = require('chai').expect;
const BluebirdPromise = require('bluebird');
const DbModels = require('../../../../models');
const DbClient = require('../../../../lib/lora-lib/dbClient');
const consts = require('../../../../lib/lora-lib/constants');
const MqClient = require('../../../../lib/lora-lib/mqClient/kafka');

const JoinResHandler = require('../../../../lib/converter/joinResHandler');
const config = require('../../../../config');
const mochaConfig = config.mocha;
const Log = require('../../../../lib/lora-lib/log');
const log = new Log(config.log);

const testConsts = require('../../testConstants');

const testTopic = ['JS-sub'];
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
    topics: testTopic,
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
    pubToJoinServer: 'JS-sub',
    subFromJoinServer: 'JS-pub',
  },
};

describe('Test AppDataHandler', function () {
  let dbModels = new DbModels(DbClient);
  let mysqlConn = dbModels.mysqlConn;
  let mqClient;
  let joinResHandler;

  let DeviceStatus = mysqlConn.DeviceStatus;
  let DeviceRouting = mysqlConn.DeviceRouting;
  let DeviceConfig = mysqlConn.DeviceConfig;
  let DeviceInfo = mysqlConn.DeviceInfo;
  let AppInfo = mysqlConn.AppInfo;
  let Developers = mysqlConn.Developers;

  this.timeout(mochaConfig.timeout);
  before('Test UserInfo & AppInfo & DeviceInfo & DeviceConfig To createItem a device ',
    function (done) {
      Developers.createItem(testConsts.testDeveloper)
        .then(function () {
          return AppInfo.createItem(testConsts.testApp);
        })
        .then(function () {
          return DeviceInfo.createItem(testConsts.testDeviceInfo);
        })
        .then(function () {
          return DeviceConfig.createItem(testConsts.testDeviceConfig);
        })
        .then(() => { done(); })
        .catch(function (err) {
          console.log(err);
          Developers.removeItem(testConsts.delOpts).then(function () {
            done(err);
          });
        });
    });

  before('create a consumer of JS-sub topic  && a joinResHandler ',
    function (done) {
      this.timeout(10000);
      mqClient = new MqClient(options, log);

      mqClient.connect().then(function () {
        console.log('mqClient connect, both consumer and producer');

        joinResHandler = new JoinResHandler(mqClient, dbModels.redisConn, dbModels.mysqlConn, log);

        done();
      }).catch(function (err) {
        console.log('mqClient connect failed : ', err.message);
        done(err);
      });
    });

  it('Test Function Handler()', function (done) {

    joinResHandler.handler(testConsts.uplinkRxInfoArr[0])
      .then(function (res) {
        return DeviceRouting.readItem({ DevAddr: testConsts.testDeviceInfo.DevAddr });
      })
      .then(function (res) {
        expect(res.tmst).to.be.equal(testConsts.uplinkRxInfoArr[0].tmst +
          consts.TXPK_CONFIG.TMST_OFFSET_JOIN);
        done();
      })
      .catch(function (err) {
        console.log(err);
        done(err);
      });
  });

  it('Test Function joinRequestHandle()', function (done) {

    let uplinkCompleteData = [testConsts.uplinkCompleteData];
    joinResHandler.joinRequestHandle(uplinkCompleteData)
      .catch(function (err) {
        console.log(err);
        done(err);
      });

    mqClient.message(function (message) {
      if (message.topic === testTopic[0]) {
        console.log('Received message from AS-sub Topic');
        done();
      }
    });

  });

  after('Remove the data in mysql database', function (done) {
    Developers.removeItem(testConsts.delOpts)
      .then(function () {
        done();
      })
      .catch(function (err) {
        console.log(err);
        Developers.removeItem(testConsts.delOpts).then(function () {
          done(err);
        });
      });
  });

  after('Close connection', function () {
    BluebirdPromise.all([mqClient.disconnect(), dbModels.close()]).then(function () {
      console.log('mqclient & dbModels  disconnect');
    });
  });
});
