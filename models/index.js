'use strict';

const BluebirdPromise = require('bluebird');
const RedisModels = require('./redisModels');
const MysqlModels = require('../lib/lora-lib/mysqlModels');
const consts = require('../lib/lora-lib/constants');

function DbModels(dbClient) {

  let _this = this;

  this._ioredis = dbClient('redis');
  this._sequelize = dbClient('mysql');
  this.redisConn = {};
  this.mysqlConn = {};

  /* create model instance */
  Object.keys(RedisModels).forEach(function (key) {
    _this.redisConn[key] = new RedisModels[key](_this._ioredis);
  });

  Object.keys(MysqlModels).forEach(function (key) {
    _this.mysqlConn[key] = new MysqlModels[key](_this._sequelize);
  });

  /* create association between entities */
  let modelIns = this.mysqlConn;

  modelIns.GatewayStatus._model.belongsTo(
    modelIns.GatewayInfo._model, {
      foreignKey: 'gatewayId',
      onDelete: 'CASCADE',
    });

  modelIns.GatewayInfo._model.belongsTo(
    modelIns.Developers._model, {
      targetKey: 'developer_id',
      foreignKey: 'userID',
      onDelete: 'CASCADE',
    }
  );

  modelIns.AppInfo._model.belongsTo(
    modelIns.Developers._model, {
      targetKey: 'developer_id',
      foreignKey: 'userID',
      onDelete: 'CASCADE',
    }
  );

  modelIns.DeviceInfo._model.belongsTo(
    modelIns.AppInfo._model, {
      foreignKey: 'AppEUI',
      onDelete: 'CASCADE',
    }
  );

  modelIns.DeviceStatus._model.belongsTo(
    modelIns.DeviceInfo._model, {
      foreignKey: 'DevAddr',
      onDelete: 'CASCADE',
      targetKey: 'DevAddr',
    }
  );

  modelIns.DeviceRouting._model.belongsTo(
    modelIns.DeviceInfo._model, {
      foreignKey: 'DevAddr',
      onDelete: 'CASCADE',
      targetKey: 'DevAddr',
    }
  );

  modelIns.DeviceConfig._model.belongsTo(
    modelIns.DeviceInfo._model, {
      foreignKey: 'DevAddr',
      onDelete: 'CASCADE',
      targetKey: 'DevAddr',
    }
  );

  this.mysqlConn.getTxpkInfo = function (devaddr) {
    return modelIns.DeviceRouting.getTxpkInfo(devaddr, modelIns.DeviceInfo, modelIns.DeviceConfig);
  };

  this._sequelize.sync();
}

DbModels.prototype.close = function () {
  let _this = this;
  return BluebirdPromise.all([
    _this._sequelize.close(),
    _this._ioredis.disconnect(),
  ]);
};

module.exports = DbModels;
