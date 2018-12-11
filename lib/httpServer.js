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
    this.app.listen(this.config.http.port);
  }

  register() {
    const register = async ctx => {
      const { email, password } = ctx.request.body;
      const reg = new RegExp("^([a-zA-Z0-9]+[_|\-|\.]?)*[a-zA-Z0-9]+@([a-zA-Z0-9]+[_|\-|\.]?)*[a-zA-Z0-9]+\.[a-zA-Z]{2,3}$");
      if (!reg.test(email)) {
        ctx.response.body = {
          code: 2101,
          message: 'invalid email'
        };
      } else if (password.length < 6 || password.length > 32) {
        ctx.response.body = {
          code: 2102,
          message: 'invalid password'
        };
      } else {
        const md5 = crypto.createHash(consts.HASH_METHOD);
        const query = {
          email: email,
          password: password,
          developer_id: md5.update(email).digest('hex'),
          name: email,
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
    };
    this.app.use(route.post('/register', register));
  }

  login() {
    const login = async ctx => {
      const { email, password } = ctx.request.body;
      const reg = new RegExp("^([a-zA-Z0-9]+[_|\-|\.]?)*[a-zA-Z0-9]+@([a-zA-Z0-9]+[_|\-|\.]?)*[a-zA-Z0-9]+\.[a-zA-Z]{2,3}$");
      if (!reg.test(email)) {
        ctx.response.body = {
          code: 2101,
          message: 'invalid email'
        };
      } else if (password.length < 6 || password.length > 32) {
        ctx.response.body = {
          code: 2102,
          message: 'invalid password'
        };
      } else {
        const whereOpts = {
          email: email
        };
        try {
          await this.Developers.readItem(whereOpts, ['password', 'developer_id'])
            .then((res) => {
              if (res.password === password) {
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
    };
    this.app.use(route.post('/login', login));
  }

  application() {
    const application = async ctx => {
      const { userID, AppEUI, name } = ctx.request.body;
      const query = {
        userID: userID,
        AppEUI: AppEUI,
        name: name
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
    };
    this.app.use(route.post('/application', application));
  }

  device() {
    const device = async ctx => {
      const { AppEUI, DevEUI, AppKey } = ctx.request.body;
      const query = {
        AppEUI: AppEUI,
        DevEUI: DevEUI,
        AppKey: AppKey
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
    };
    this.app.use(route.post('/device', device));
  }

  gateway() {
    const gateway = async ctx => {
      const { userID, gatewayId } = ctx.request.body;
      const query = {
        userID: userID,
        gatewayId: gatewayId,
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
    };
    this.app.use(route.post('/gateway', gateway));
  }

  maccommand() {
    const maccommand = async ctx => {
      const { devAddr, maccommand } = ctx.request.body;
      const query = {
        devAddr: devAddr,
        maccommand: maccommand,
      };
      if (query.devAddr.length != consts.DEVADDR_LEN * 2) {
        ctx.response.body = {
          code: 2106,
          message: 'invalid devAddr'
        };
      } else if (query.maccommand.length < 2 || query.maccommand.length > 12) {
        ctx.response.body = {
          code: 2106,
          message: 'invalid outputObj'
        };
      } else {
        const mqKey = consts.MACCMDQUEREQ_PREFIX + devAddr;
        const output = utils.maccommandIssuer(maccommand);
        if (JSON.stringify(output) === '{}') {
          ctx.response.body = {
            code: 2106,
            message: 'invalid outputObj'
          };
        } else if (output.hasOwnProperty('code')) {
          ctx.response.body = output;
        }
        try {
          await this.DownlinkCmdQueue.produce(mqKey, output)
            .then(() => {
              ctx.response.body = {
                code: 200,
                message: output
              };
            });
        } catch (error) {
          ctx.response.body = { 'message': error.message };
        }
      }
    };
    this.app.use(route.post('/maccommand', maccommand));
  }
};

module.exports = HttpServer;
