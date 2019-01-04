const crypto = require('crypto');
const consts = require('../lib/lora-lib/constants');
const utils = require('../lib/lora-lib/utils');
const Koa = require('koa');
const route = require('koa-route');
const bodyParser = require('koa-bodyparser');

const HttpServer = class {
  constructor(dbModels, log) {
    this.log = log;
    this.dbModels = dbModels;
    this.mysqlConn = this.dbModels.mysqlConn;
    this.redisConn = this.dbModels.redisConn;
    this.Developers = this.mysqlConn.Developers;
    this.AppInfo = this.mysqlConn.AppInfo;
    this.DeviceInfo = this.mysqlConn.DeviceInfo;
    this.GatewayInfo = this.mysqlConn.GatewayInfo;
    this.DownlinkCmdQueue = this.redisConn.DownlinkCmdQueue;
    this.redisConnMsgQue = this.redisConn.MessageQueue;
    this.app = new Koa();
  }

  bind(config) {
    this.config = config;
    this.app.use(bodyParser());
    this.register();
    this.login();
    this.application();
    this.device();
    this.gateway();
    this.maccommand();
    this.downlink();
    this.app.listen(this.config.http.port);
  }

  register() {
    const register = async ctx => {
      const body = ctx.request.body;
      if (!body.email) {
        ctx.response.body = {
          code: 3105,
          message: 'email required'
        };
      } else if (!body.password) {
        ctx.response.body = {
          code: 3106,
          message: 'password required'
        };
      } else {
        const reg = new RegExp("^([a-zA-Z0-9]+[_|\-|\.]?)*[a-zA-Z0-9]+@([a-zA-Z0-9]+[_|\-|\.]?)*[a-zA-Z0-9]+\.[a-zA-Z]{2,3}$");
        if (!reg.test(body.email)) {
          ctx.response.body = {
            code: 2101,
            message: 'invalid email'
          };
        } else if (body.password.length < 6 || body.password.length > 32) {
          ctx.response.body = {
            code: 2102,
            message: 'invalid password'
          };
        } else {
          const md5 = crypto.createHash(consts.HASH_METHOD);
          const query = {
            email: body.email,
            password: body.password,
            developer_id: md5.update(body.email).digest('hex'),
            name: body.email,
            time: Date.now() / 1000
          };
          try {
            await this.Developers.createItem(query)
              .then(() => {
                ctx.response.body = {
                  userID: query.developer_id
                };
              });
          } catch (error) {
            if (error.name === 'SequelizeUniqueConstraintError') {
              ctx.response.body = {
                code: 3101,
                message: 'user already registered'
              };
            } else {
              ctx.response.body = { 'message': error.message };
            }
          }
        }
      }
    };
    this.app.use(route.post('/register', register));
  }

  login() {
    const login = async ctx => {
      const body = ctx.request.body;
      if (!body.email) {
        ctx.response.body = {
          code: 3105,
          message: 'email required'
        };
      } else if (!body.password) {
        ctx.response.body = {
          code: 3106,
          message: 'password required'
        };
      } else {
        const reg = new RegExp("^([a-zA-Z0-9]+[_|\-|\.]?)*[a-zA-Z0-9]+@([a-zA-Z0-9]+[_|\-|\.]?)*[a-zA-Z0-9]+\.[a-zA-Z]{2,3}$");
        if (!reg.test(body.email)) {
          ctx.response.body = {
            code: 2101,
            message: 'invalid email'
          };
        } else if (body.password.length < 6 || body.password.length > 32) {
          ctx.response.body = {
            code: 2102,
            message: 'invalid password'
          };
        } else {
          const whereOpts = {
            email: body.email
          };
          try {
            await this.Developers.readItem(whereOpts, ['password', 'developer_id'])
              .then((res) => {
                if (res.password === body.password) {
                  ctx.response.body = {
                    'userID': res.developer_id
                  };
                } else if (res.password === null) {
                  ctx.response.body = {
                    code: 3102,
                    message: 'user not registered'
                  };
                } else {
                  ctx.response.body = {
                    code: 3103,
                    message: 'user password error'
                  };
                }
              });
          } catch (error) {
            ctx.response.body = { 'message': error.message };
          }
        }
      }
    };
    this.app.use(route.post('/login', login));
  }

  application() {
    const application = async ctx => {
      const body = ctx.request.body;
      if (!body.userID) {
        ctx.response.body = {
          code: 3104,
          message: 'userID required'
        };
      } else if (!body.AppEUI) {
        ctx.response.body = {
          code: 3107,
          message: 'AppEUI required'
        }
      } else if (!body.name) {
        ctx.response.body = {
          code: 3108,
          message: 'name required'
        }
      } else {
        const query = {
          userID: body.userID,
          AppEUI: body.AppEUI,
          name: body.name
        };
        if (query.AppEUI.length != consts.APPEUI_LEN * 2) {
          ctx.response.body = {
            code: 2103,
            message: 'invalid AppEUI'
          };
        } else {
          try {
            await this.AppInfo.createItem(query)
              .then(() => {
                ctx.response.body = {
                  code: 200,
                  message: 'success'
                };
              });
          } catch (error) {
            if (error.name === 'SequelizeUniqueConstraintError') {
              ctx.response.body = {
                code: 3201,
                message: 'application already created'
              };
            } else if (error.name === 'SequelizeForeignKeyConstraintError') {
              ctx.response.body = {
                code: 3102,
                message: 'user not registered'
              };
            } else {
              ctx.response.body = { 'message': error.message };
            }
          }
        }
      }
    };
    this.app.use(route.post('/application', application));
  }

  device() {
    const device = async ctx => {
      const body = ctx.request.body;
      if (!body.AppEUI) {
        ctx.response.body = {
          code: 3107,
          message: 'AppEUI required'
        };
      } else if (!body.DevEUI) {
        ctx.response.body = {
          code: 3109,
          message: 'DevEUI required'
        };
      } else if (!body.AppKey) {
        ctx.response.body = {
          code: 3110,
          message: 'AppKey required'
        };
      } else {
        const query = {
          AppEUI: body.AppEUI,
          DevEUI: body.DevEUI,
          AppKey: body.AppKey
        };
        if (query.AppEUI.length != consts.APPEUI_LEN * 2) {
          ctx.response.body = {
            code: 2103,
            message: 'invalid AppEUI'
          };
        } else if (query.DevEUI.length != consts.DEVEUI_LEN * 2) {
          ctx.response.body = {
            code: 2104,
            message: 'invalid DevEUI'
          };
        } else if (query.AppKey.length != consts.APPKEY_LEN * 2) {
          ctx.response.body = {
            code: 2105,
            message: 'invalid AppKey'
          };
        } else {
          try {
            await this.DeviceInfo.createItem(query)
              .then(() => {
                ctx.response.body = {
                  code: 200,
                  message: 'success'
                };
              });
          } catch (error) {
            if (error.name === 'SequelizeUniqueConstraintError') {
              ctx.response.body = {
                code: 3301,
                message: 'device already created'
              };
            } else if (error.name === 'SequelizeForeignKeyConstraintError') {
              ctx.response.body = {
                code: 3202,
                message: 'application not created'
              };
            } else {
              ctx.response.body = { 'message': error.message };
            }
          }
        }
      }
    };
    this.app.use(route.post('/device', device));
  }

  gateway() {
    const gateway = async ctx => {
      const body = ctx.request.body;
      if (!body.userID) {
        ctx.response.body = {
          code: 3104,
          message: 'userID required'
        };
      } else if (!body.gatewayId) {
        ctx.response.body = {
          code: 3111,
          message: 'gatewayId required'
        };
      } else {
        const query = {
          userID: body.userID,
          gatewayId: body.gatewayId,
        };
        if (query.gatewayId.length != consts.GATEWAYID_LEN * 2) {
          ctx.response.body = {
            code: 2106,
            message: 'invalid gatewayId'
          };
        } else {
          try {
            await this.GatewayInfo.createItem(query)
              .then(() => {
                ctx.response.body = {
                  code: 200,
                  message: 'success'
                };
              });
          } catch (error) {
            if (error.name === 'SequelizeUniqueConstraintError') {
              ctx.response.body = {
                code: 3401,
                message: 'gateway already created'
              };
            } else if (error.name === 'SequelizeForeignKeyConstraintError') {
              ctx.response.body = {
                code: 3102,
                message: 'user not registered'
              };
            } else {
              ctx.response.body = { 'message': error.message };
            }
          }
        }
      }
    };
    this.app.use(route.post('/gateway', gateway));
  }

  maccommand() {
    const maccommand = async ctx => {
      const body = ctx.request.body;
      if (!body.DevAddr) {
        ctx.response.body = {
          code: 3112,
          message: 'DevAddr required'
        };
      } else if (!body.MACCommand) {
        ctx.response.body = {
          code: 3113,
          message: 'MACCommand required'
        };
      } else {
        const query = {
          DevAddr: body.DevAddr,
          MACCommand: body.MACCommand,
        };
        if (query.DevAddr.length != consts.DEVADDR_LEN * 2) {
          ctx.response.body = {
            code: 2107,
            message: 'invalid DevAddr'
          };
        } else if (query.MACCommand.length < 2 || query.MACCommand.length > 12) {
          ctx.response.body = {
            code: 2108,
            message: 'invalid MACCommand'
          };
        } else {
          const mqKey = consts.MACCMDQUEREQ_PREFIX + query.DevAddr;
          const output = utils.maccommandIssuer(query.MACCommand);
          if (JSON.stringify(output) === '{}') {
            ctx.response.body = {
              code: 2108,
              message: 'invalid MACCommand, payload not exist'
            };
          } else if (output.hasOwnProperty('code')) {
            ctx.response.body = {
              code: 2108,
              message: 'invalid MACCommand, ' + output.message
            };
          } else {
            try {
              await this.DownlinkCmdQueue.produce(mqKey, output)
                .then(() => {
                  ctx.response.body = {
                    code: 200,
                    message: 'success'
                  };
                });
            } catch (error) {
              ctx.response.body = { 'message': error.message };
            }
          }
        }
      }
    };
    this.app.use(route.post('/maccommand', maccommand));
  }

  downlink() {
    const downlink = async ctx => {
      const body = ctx.request.body;
      if (!body.DevAddr) {
        ctx.response.body = {
          code: 3112,
          message: 'DevAddr required'
        };
      } else if (!body.Downlink) {
        ctx.response.body = {
          code: 3114,
          message: 'Downlink required'
        };
      } else {
        const query = {
          DevAddr: body.DevAddr,
          Downlink: body.Downlink,
        };
        if (query.DevAddr.length != consts.DEVADDR_LEN * 2) {
          ctx.response.body = {
            code: 2107,
            message: 'invalid DevAddr'
          };
        } else if (query.Downlink.length === 0) {
          ctx.response.body = {
            code: 2109,
            message: 'invalid Downlink'
          };
        } else {
          const msgQueKey = consts.DOWNLINK_MQ_PREFIX + query.DevAddr;
          try {
            await this.redisConnMsgQue.produceByHTTP(msgQueKey, query.Downlink)
              .then(() => {
                ctx.response.body = {
                  code: 200,
                  message: 'success'
                };
              });
          } catch (error) {
            ctx.response.body = { 'message': error.message };
          }
        }
      }
    };
    this.app.use(route.post('/downlink', downlink));
  }
};

module.exports = HttpServer;
