const _ = require('lodash');
const BluebirdPromise = require('bluebird');

const loraLib = require('../lib/lora-lib');
const {MQClient, ERROR} = loraLib;
const DataConverter = require('./converter/dataConverter');

function DataHandler(options, dbModels, log) {

  /* properties */
  this.options = options || {};
  this.dbModels = dbModels;
  this.log = log;
}

DataHandler.prototype.start = function () {

  let _this = this;

  /* backend client init */
  let dbModels = this.dbModels;
  let redisConn = dbModels.redisConn;
  let mysqlConn = dbModels.mysqlConn;
  let mqClient = this.mqClient = new MQClient(this.options.mqClient_ns, this.log);

  let dataConverter = this.dataConverter = new DataConverter(mqClient,
    redisConn, mysqlConn, _this.log);

  /* private functions */
  let getHandlers = function (name) {
    let handlers = {

      // Network Connector --> Network Server
      [_this.options.mqClient_ns.topics.subFromConnector]: function (msg) {
        _this.log.info({
          label: `Msg from ${_this.options.mqClient_ns.topics.subFromConnector}`,
          message: msg.value,
        });
        let uplinkPayload = msg.value;

        return dataConverter.uplinkDataHandler(uplinkPayload);
      },

      // Join Server --> Network Server
      [_this.options.mqClient_ns.topics.subFromJoinServer]: function (msg) {
        _this.log.info({
          label: `Msg from ${_this.options.mqClient_ns.topics.subFromJoinServer}`,
          message: msg.value,
        });

        return dataConverter.joinAcceptHandler(msg.value);
      },

      default: function () {
        return BluebirdPromise.reject(new Error('Invalid kafka topic'));
      },
    };

    return handlers[name] || handlers['default'];
  };

  /* connect & start */
  _this.log.info('Data handler started...');
  return Promise.all([mqClient.connect()]).then(function () {

    mqClient.message(function (message) {
      let fn = getHandlers(message.topic);
      fn(message)
        .catch(function (error) {
          _this.errorHandler(error);
        });
    });

    _this.log.info('Listening on Kafka topic : ' + _this.options.mqClient_ns.consumerGroup.topics);
    return BluebirdPromise.resolve();
  });
};

DataHandler.prototype.errorHandler = function (error) {
  let _this = this;
  if (error instanceof ERROR.MsgTypeError) {
    _this.log.error(error.message);
  } else if (error instanceof ERROR.JsonSchemaError) {
    _this.log.error(error.message);
  } else if (error instanceof ERROR.DeviceNotExistError) {
    _this.log.error(error.message);
  } else if (error instanceof ERROR.InvalidFCntError) {
    _this.log.error(error.message);
  } else {
    _this.log.error(error.stack);
  }
};

DataHandler.prototype.close = function () {
  let _this = this;
  _this.log.debug('Data handler closed...');
  return BluebirdPromise.all([
    _this.mqClient.disconnect(),
    _this.dbModels.close(),
  ]);
};

module.exports = DataHandler;
