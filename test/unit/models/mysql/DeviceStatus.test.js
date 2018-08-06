'use strict';

const chai = require('chai');
chai.use(require('chai-json-schema-ajv'));
const expect = chai.expect;
const DbModels = require('../../../../models');
const DbClient = require('../../../../lib/lora-lib/dbClient');

// test data for mysql
const testConsts = require('../../testConstants');
describe('Test DeviceStatus model', function () {

  let dbModels;
  let mysqlConn;
  let DeviceStatus;
  let DeviceConfig;
  let DeviceInfo;
  let AppInfo;
  let Developers;
  before('Get connection with MySQL', function (done) {
    dbModels = new DbModels(DbClient);
    mysqlConn = dbModels.mysqlConn;
    DeviceStatus = mysqlConn.DeviceStatus;
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
      }).then(() => { done(); })
      .catch(function (err) {
        console.log(err);
        Developers.removeItem(testConsts.delOpts);
        done(err);
      });
  });

  it('DeviceConfig createItem & updateItem & readItem', function (done) {

    let whereOpts = { DevAddr: testConsts.testDeviceInfo.DevAddr };
    DeviceStatus.createItem(testConsts.testDeviceStatus)
      .then(function (res) {
        return DeviceStatus.readItem(whereOpts);
      })
      .then(function (res) {
        expect(res).to.be.an('object');
        expect(res.rfch).to.be.equal(testConsts.testDeviceStatus.rfch);
        let updateOpts = { rfch: 1 };
        return DeviceStatus.updateItem(whereOpts, updateOpts);
      }).then(function () {
        return DeviceStatus.readItem(whereOpts);
      }).then(function (res) {
        expect(res.rfch).to.equal(1);
        done();
      })
      .catch(function (err) {
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
