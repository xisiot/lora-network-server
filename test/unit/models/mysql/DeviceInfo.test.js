'use strict';

const expect = require('chai').expect;
const _sequelize = require('../../../../lib/dbClient')('mysql');
const DbModels = require('../../../../models');
const DbClient = require('../../../../lib/dbClient');
const consts = require('../../../../lib/lora-lib/constants');

// test data for mysql
const testConsts = require('../../testConstants');

describe('Test DeviceInfo model', function () {

  let dbModels;
  let AppInfo;
  let DeviceInfo;
  let Developers;

  before('Create mysql instance', function (done) {
    dbModels = new DbModels(DbClient);
    let mysqlConn = dbModels.mysqlConn;

    AppInfo = mysqlConn.AppInfo;
    DeviceInfo = mysqlConn.DeviceInfo;
    Developers = mysqlConn.Developers;

    Developers.createItem(testConsts.testDeveloper)
      .then(function () {
        return AppInfo.createItem(testConsts.testApp);
      })
      .then(function () {
        return DeviceInfo.createItem(testConsts.testDeviceInfo);
      })
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

  it('Test function increaseFcntup & increaseAfcntdown & increaseNfcntdown', function (done) {
    const devAddr = testConsts.testDeviceInfo.DevAddr;
    const testFcntup = 10;
    DeviceInfo.increaseFcntup(devAddr, testFcntup).then(function (res) {
      return DeviceInfo.readItem({ DevAddr: devAddr }, ['DevAddr', 'FcntUp']);
    }).then(function (res) {
      expect(res.FcntUp).to.be.equal(testFcntup);
      return DeviceInfo.increaseAfcntdown(devAddr);
    }).then(function (res) {
      return DeviceInfo.increaseNfcntdown(devAddr);
    }).then(function (res) {
      return DeviceInfo.readItem({ DevAddr: devAddr }, ['DevAddr', 'AFCntDown', 'NFCntDown']);
    }).then(function (res) {
      expect(res.AFCntDown).to.be.equal(testConsts.testDeviceInfo.AFCntDown + 1);
      expect(res.NFCntDown).to.be.equal(testConsts.testDeviceInfo.NFCntDown + 1);
    }).then(function (res) {
      done();
    }).catch(function (err) {
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
