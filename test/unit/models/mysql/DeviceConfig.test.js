'use strict';

const chai = require('chai');
chai.use(require('chai-json-schema-ajv'));
const expect = chai.expect;
const config = require('../../../../config');

const DbModels = require('../../../../models');
const DbClient = require('../../../../lib/lora-lib/dbClient');

const testConsts = require('../../testConstants');

describe('Test DeviceConfig model', function () {

  let dbModels;
  let mysqlConn;
  let deviceConfig;
  let DeviceInfo;
  let AppInfo;
  let Developers;
  before('Create mysql instance', function () {
    dbModels = new DbModels(DbClient);
    mysqlConn = dbModels.mysqlConn;
    deviceConfig = mysqlConn.DeviceConfig;
    DeviceInfo = mysqlConn.DeviceInfo;
    AppInfo = mysqlConn.AppInfo;
    Developers = mysqlConn.Developers;
  });

  before('Test UserInfo & AppInfo & DeviceInfo To createItem a device ', function (done) {
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

  it('DeviceConfig createItem & updateItem & readItem', function (done) {

    let whereOpts = { DevAddr: testConsts.testDeviceInfo.DevAddr };

    deviceConfig.createItem(testConsts.testDeviceConfig)
      .then(function () {
        return deviceConfig.readItem(whereOpts);
      })
      .then(function (res) {
        expect(res).to.be.an('object');
        expect(res.frequencyPlan).to.equal(testConsts.testDeviceConfig.frequencyPlan);
        expect(res.ADR).to.equal(testConsts.testDeviceConfig.ADR);
        expect(res.ChMask).to.equal(testConsts.testDeviceConfig.ChMask);

        let updateOpts = { RX1DRoffset: 3 };
        return deviceConfig.updateItem(whereOpts, updateOpts);
      }).then(function () {
        return deviceConfig.readItem(whereOpts);
      }).then(function (res) {
        expect(res.RX1DRoffset).to.equal(3);
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
