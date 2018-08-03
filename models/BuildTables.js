'use strict';

const loraLib = require('../lib/lora-lib');
const config = require('../config');
const {Models, dbClient} = loraLib;
const _sequelize = dbClient.createSequelizeClient(config.database.mysql);

const modelIns = {};
for (let model in Models.MySQLModels) {
  modelIns[model] = new Models.MySQLModels[model](_sequelize);
}

modelIns.GatewayStatus._model.belongsTo(
  modelIns.GatewayInfo._model, {
    foreignKey: 'gatewayId',
    onDelete: 'CASCADE',
  }
);

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

_sequelize.sync({ force: true }).then(function () {
  console.log('Successfully building the Tables in mysql Database');
  _sequelize.close();
}).catch(function (err) {
  console.log(err);
});
