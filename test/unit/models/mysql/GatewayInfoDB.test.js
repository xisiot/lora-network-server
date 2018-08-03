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
const DbClient = require('../../../../lib/lora-lib/dbClient');

// test data for mysql
const testConsts = require('../../testConstants');

describe('Test GatewayInfo model', function () {

  let dbModels;
  let mysqlConn;
  let GatewayInfo;
  let Developers;
  before('Get connection with MySQL', function () {

    dbModels = new DbModels(DbClient);
    mysqlConn = dbModels.mysqlConn;
    GatewayInfo = mysqlConn.GatewayInfo;
    Developers = mysqlConn.Developers;
  });

  this.timeout(mochaConfig.timeout);
  it('GatewayInfo createItem & updateItem & readItem & removeItem', function (done) {
    const whereOpts = { gatewayId: testConsts.testGatewayInfo.gatewayId };
    Developers.createItem(testConsts.testDeveloper)
      .then(function () {
        return GatewayInfo.createItem(testConsts.testGatewayInfo);
      })
      .then(function () {
        return GatewayInfo.readItem(whereOpts);
      })
      .then(function (res) {
        expect(res).to.be.an('object');
        expect(res.gatewayId).to.deep.equal(testConsts.testGatewayInfo.gatewayId);
        expect(res.gatewayId.length).to.equal(consts.GATEWAYID_LEN);
        expect(res.userID).to.equal(testConsts.testGatewayInfo.userID);
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
