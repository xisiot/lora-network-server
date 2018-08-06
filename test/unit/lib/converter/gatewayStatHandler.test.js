'use strict';

const chai = require('chai');
chai.use(require('chai-json-schema-ajv'));
const expect = chai.expect;
const consts = require('../../../../lib/lora-lib/constants');

const DbModels = require('../../../../models');
const DbClient = require('../../../../lib/lora-lib/dbClient');
const GatewayStatHandler = require('../../../../lib/converter/gatewayStatHandler');

// test data for mysql
const testConsts = require('../../testConstants');

describe('Test GatewayStatus model', function () {

  let dbModels;
  let mysqlConn;
  let GatewayStatus;
  let GatewayInfo;
  let Developers;
  let gatewayStatHandler;

  before('Get connection with MySQL', function (done) {
    dbModels = new DbModels(DbClient);
    mysqlConn = dbModels.mysqlConn;
    Developers = mysqlConn.Developers;
    GatewayInfo = mysqlConn.GatewayInfo;
    GatewayStatus = mysqlConn.GatewayStatus;
    gatewayStatHandler = new GatewayStatHandler(GatewayStatus);

    Developers.createItem(testConsts.testDeveloper)
      .then(function () {
        return GatewayInfo.createItem(testConsts.testGatewayInfo);
      })
      .then(function (res) {
        done();
      })
      .catch(function (err) {
        console.log(err);
        Developers.removeItem(testConsts.delOpts);
        done(err);
      });
  });

  it('Test Function handle', function (done) {

    const whereOpts = {
      gatewayId: testConsts.testGatewayInfo.gatewayId,
    };

    gatewayStatHandler.handle(testConsts.testGatewayStatus)
      .then(function () {
        return GatewayStatus.readItem(whereOpts);
      })
      .then(function (res) {
        expect(res).to.be.an('object');
        expect(res.gatewayId).to.deep.equal(testConsts.testGatewayInfo.gatewayId);
        expect(res.gatewayId.length).to.equal(consts.GATEWAYID_LEN);
        return Developers.removeItem(testConsts.delOpts);
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

  after('Close connection after 100ms', function (done) {
    setTimeout(function () {
      dbModels.close().then(function () {
        done();
      });
    }, 100);
  });
});
