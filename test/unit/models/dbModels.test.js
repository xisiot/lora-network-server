'use strict';

const expect = require('chai').expect;

const DbModels = require('../../../models');
const DbClient = require('../../../lib/lora-lib/dbClient');
const consts = require('../../../lib/lora-lib/constants');

// test data for redis
const listKey = 'testRedis';
const pushData = 'pushTestString';

// test data for mysql
const testConsts = require('../testConstants');

const whereOpts = {
  DevAddr: testConsts.testDeviceInfo.DevAddr,
};

describe('Test dbModels', function () {

  let dbModels = new DbModels(DbClient);
  let mysqlConn = dbModels.mysqlConn;
  let redisConn = dbModels.redisConn;
  let deviceConfig = mysqlConn.DeviceConfig;
  let DeviceInfo = mysqlConn.DeviceInfo;
  let AppInfo = mysqlConn.AppInfo;
  let Developers = mysqlConn.Developers;

  it('Use mysql connection & create a Device', function (done) {

    Developers.createItem(testConsts.testDeveloper)
      .then(function () {
        return AppInfo.createItem(testConsts.testApp);
      })
      .then(function () {
        return DeviceInfo.createItem(testConsts.testDeviceInfo);
      })
      .then(function () {
        return DeviceInfo.readItem(whereOpts);
      })
      .then(function (res) {

        expect(res).to.be.an('object');
        expect(res.DevEUI).to.deep.equal(testConsts.testDeviceInfo.DevEUI);
        expect(res.FCntUp).to.equal(0);

        let updateOpts = { FCntUp: 10 };
        return DeviceInfo.updateItem(whereOpts, updateOpts);
      }).then(function () {
        return DeviceInfo.readItem(whereOpts);
      }).then(function (res) {
        expect(res.FCntUp).to.equal(10);
        return DeviceInfo.removeItem(whereOpts);
      }).then(function (res) {
        done();
      })
      .catch(function (err) {
        console.log(err);
        Developers.removeItem(testConsts.delOpts).then(function () {
          done(err);
        });
      });
  });

  it('Use mysql connection & remove data', function (done) {
    Developers.removeItem(testConsts.delOpts)
      .then(function () {
        done();
      })
      .catch(function (err) {
        console.log(err);
        done(err);
      });
  });

  it('Use redis connection', function (done) {

    redisConn.DeDuplication._ioredis.lpush(listKey, pushData).then(function () {
      return redisConn.DeDuplication._ioredis.lpop(listKey);
    }).then(function (res) {
      expect(res).to.equal(pushData);

    }).then(function () {
      redisConn.DeDuplication._ioredis.del(listKey);
    }).then(function () {
      done();
    }).catch(function (err) {
      redisConn.DeDuplication._ioredis.del(listKey);
      console.log(err);
    });
  });

  after('Close connection after 200ms', function (done) {
    setTimeout(function () {
      dbModels.close().then(function () {
        done();
      });
    }, 200);
  });
});
