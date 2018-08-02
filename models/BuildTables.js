'use strict';

const MysqlModels = require('../lib/lora-lib/mysqlModels');
const sequelize = require('../lib/dbClient')('mysql');

const modelIns = {};
for (let model in MysqlModels) {
  modelIns[model] = new MysqlModels[model](sequelize);
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

sequelize.sync({ force: true }).then(function () {
  sequelize.close();
});
