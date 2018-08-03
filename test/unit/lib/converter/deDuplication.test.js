'use strict';
const BluebirdPromise = require('bluebird');
const chai = require('chai');
chai.use(require('chai-json-schema-ajv'));
const expect = chai.expect;

const mocha = require('mocha');
const config = require('../../../../config');
const mochaConfig = config.mocha;
const consts = require('../../../../lib/lora-lib/constants');

const DbModels = require('../../../../models');
const DbClient = require('../../../../lib/lora-lib/dbClient');
const DeDupliaction = require('../../../../lib/converter/deDuplication');

let dbModels = new DbModels(DbClient);
let messageQueue = dbModels.redisConn.MessageQueue;
let deDuplication = new DeDupliaction(messageQueue);

const oneUplingMsg = {
  'version': '02',
  'token': '5ab3',
  'identifier': '00',
  'gatewayId': '32f9bdfffee3e603',
  'rxpk': {
    'tmst': 2303093204,
    'chan': 0,
    'rfch': 1,
    'freq': 433.9,
    'stat': 1,
    'modu': 'LORA',
    'datr': 'SF10BW125',
    'codr': '4/5',
    'lsnr': 0,
    'rssi': -43,
    'size': 17,
    'data': {},
    'raw': 'gFVjBwCAAQACPgHK5qy4UDo=',
  },
};

const twoUplingMsg = {
  'version': '02',
  'token': '5ab3',
  'identifier': '00',
  'gatewayId': '66f9bdfffee3e603',
  'rxpk': {
    'tmst': 2303093204,
    'chan': 0,
    'rfch': 1,
    'freq': 433.9,
    'stat': 1,
    'modu': 'LORA',
    'datr': 'SF10BW125',
    'codr': '4/5',
    'lsnr': 1,
    'rssi': -40,
    'size': 17,
    'data': {},
    'raw': 'gFVjBwCAAQACPgHK5qy4UDo=',
  },
};

describe('Test DeDupliaction', function () {

  describe('Test handle function', function () {
    it('Input one RXInfo Message', function (done) {
      const testJson = oneUplingMsg;
      deDuplication.handle(testJson).then(res => {
        expect(res).to.be.an('array');
        expect(res.length).to.equal(2);
        expect(res[0]).to.be.deep.equal(twoUplingMsg);
        expect(res[1]).to.be.deep.equal(oneUplingMsg);
      }).catch(err => {
        done(err);
      });
      setTimeout(() => {
        done();
      }, 100);
    });

    it('Input another RXInfo Message but has the same app data after 100ms', function (done) {
      const testJson = twoUplingMsg;
      deDuplication.handle(testJson).then(res => {
        expect(res).to.be.equal(null);
        done();
      });
    });

    it('Waitting for response', function (done) {
      setTimeout(() => {
        done();
      }, 200);
    });
  });

  after('Close connection after 100ms', function () {
    setTimeout(() => {
      dbModels.close();
    }, 100);
  });
});
