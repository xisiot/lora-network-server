'use strict';

// const util = require('util');
const BluebirdPromise = require('bluebird');
const _ = require('lodash');
const Ajv = require('ajv');
const ajv = new Ajv({ allErrors: true });
const ERRROR = require('../lora-lib/ERROR');
let gatewayStatSchema = require('./schema/gatewaySate.schema.json');
ajv.addSchema(gatewayStatSchema, 'gatewayStatSchema');

function GatewayStatHandler(GatewayStatus) {
  let _this = this;
  _this.GatewayStatus = GatewayStatus;
}

GatewayStatHandler.prototype.handle = function (GatewayStatObj) {
  let _this = this;

  let valid = ajv.validate('gatewayStatSchema', GatewayStatObj);
  if (!valid) {

    //TODO
    return BluebirdPromise.reject(
      new ERRROR.JsonSchemaError('GatewayState Schema : ' + ajv.errorsText()));
  }

  // const whereOpts = {
  //   where: {
  //     gatewayId: GatewayStatObj.gatewayId,
  //   },
  // };
  // return _this.GatewayInfo.readItem(whereOpts).then(function (res) {
  //   if (_.isEmpty(res)) {
  //     return Promise.reject(new Error('The gatewayId does not exist'));
  //   } else {
  //     return _this.GatewayStatus.createItem(GatewayStatObj);
  //   }
  // });
  // console.log('----------GatewayStatObj------------');
  // console.log(GatewayStatObj);
  return _this.GatewayStatus.createItem(GatewayStatObj);
};

module.exports = GatewayStatHandler;
