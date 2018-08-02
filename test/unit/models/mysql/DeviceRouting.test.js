'use strict';

const chai = require('chai');
chai.use(require('chai-json-schema-ajv'));
const expect = chai.expect;
const assert = chai.assert;
const mocha = require('mocha');
const consts = require('../../../../lib/lora-lib/constants');
const config = require('../../../../config');
const mochaConfig = config.mocha;

const DbModels = require('../../../../models');
const DbClient = require('../../../../lib/dbClient');

// test data for mysql
const testConsts = require('../../testConstants');

describe('Test DeviceRouting model', function () {

  let dbModels;
  let mysqlConn;
  let deviceStatus;
  let DeviceRouting;
  let DeviceConfig;
  let DeviceInfo;
  let AppInfo;
  let Developers;

  before('Create mysql instance', function (done) {
    dbModels = new DbModels(DbClient);
    mysqlConn = dbModels.mysqlConn;
    deviceStatus = mysqlConn.DeviceStatus;
    DeviceRouting = mysqlConn.DeviceRouting;
    DeviceConfig = mysqlConn.DeviceConfig;
    DeviceInfo = mysqlConn.DeviceInfo;
    AppInfo = mysqlConn.AppInfo;
    Developers = mysqlConn.Developers;

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
      .then(function () {
        return DeviceRouting.createItem(testConsts.testDeviceRouting);
      }).then(() => { done(); })
      .catch(function (err) {
        console.log(err);
        Developers.removeItem(testConsts.delOpts);
        done(err);
      });
  });

  it('Test function getTxpkInfo', function (done) {
    const devAddr = testConsts.testDeviceInfo.DevAddr;
    DeviceRouting.getTxpkInfo(Buffer.from(devAddr, 'hex'), DeviceInfo, DeviceConfig)
      .then(res => {
        expect(res.freq).to.be.equal(testConsts.testDeviceRouting.freq);
        expect(res.DeviceInfo.FCntUp).to.be.equal(testConsts.testDeviceInfo.FCntUp);
        expect(res.DeviceConfig.frequencyPlan).to.be.equal(
          testConsts.testDeviceConfig.frequencyPlan);
        done();
      }).catch(err => {
        console.log(err);
        done(err);
      });
  });

  after('Remove the data', function (done) {
    Developers.removeItem(testConsts.delOpts)
      .then(function () {
        done();
      })
      .catch(function (err) {
        console.log(err);
        done(err);
      });
  });

  after('Close connection after 100ms', function (done) {
    setTimeout(function () {
      dbModels.close().then(function () {
        done();
      });
    }, 100);
  });
});
