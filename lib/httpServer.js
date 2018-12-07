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
      if (devAddr.length != consts.DEVADDR_LEN * 2) {
        ctx.response.body = {
          code: 2106,
          message: 'invalid devAddr'
        }
      } else if (empty(maccommand)) {
        ctx.response.body = {
          code: 2106,
          message: 'invalid outputObj'
        }
      } else {
        const mqKey = consts.MACCMDQUEREQ_PREFIX + devAddr;
        const output = maccommandIssuer(maccommand);
        if (empty(output)) {
          ctx.response.body = {
            code: 2106,
            message: 'invalid outputObj'
          }
        }
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
    };
    this.app.use(route.post('/maccommand', maccommand));
  }

  maccommandIssuer(obj) {
    let obj_buffer = Buffer.from(obj, 'hex');
    let cid = utils.bufferSlice(obj_buffer, consts.CID_OFFEST, consts.CID_OFFEST + consts.CID_LEN, false);
    let output;
    if (cid.readUInt8(0) === 0x01) {
      let Version = utils.bufferSlice(obj_buffer, consts.CID_OFFEST + consts.CID_LEN,
        consts.CID_OFFEST + consts.CID_LEN + consts.RESETCONF_LEN, false);
      output = {
        [Buffer.from([consts.RESET_CID], 'hex').toString('hex')]: {
          Version: Version,
        }
      }
    } else if (cid.readUInt8(0) === 0x02) {
      let Margin = utils.bufferSlice(obj_buffer, consts.CID_OFFEST + consts.CID_LEN,
        consts.CID_OFFEST + consts.CID_LEN + consts.LINKCHECKANS.MARGIN_LEN, false);
      let GwCnt = utils.bufferSlice(obj_buffer, consts.CID_LEN + consts.LINKCHECKANS.MARGIN_LEN,
        consts.CID_LEN + consts.LINKCHECKANS.MARGIN_LEN + consts.LINKCHECKANS.GWCNT_LEN, false);
      output = {
        [Buffer.from([consts.LINKCHECK_CID], 'hex').toString('hex')]: {
          Margin: Margin,
          GwCnt: GwCnt,
        }
      }
    } else if (cid.readUInt8(0) === 0x03) {
      let TXPower = utils.bufferSlice(obj_buffer, consts.CID_OFFEST + consts.CID_LEN,
        consts.CID_OFFEST + consts.CID_LEN + consts.LINKADRREQ.DATARATE_TXPOWER_LEN, false);
      let ChMask = utils.bufferSlice(obj_buffer, consts.CID_OFFEST + consts.CID_LEN + consts.LINKADRREQ.DATARATE_TXPOWER_LEN,
        consts.CID_OFFEST + consts.CID_LEN + consts.LINKADRREQ.DATARATE_TXPOWER_LEN + consts.LINKADRREQ.CHMASK_LEN, false);
      let Redundancy = utils.bufferSlice(obj_buffer, consts.CID_OFFEST + consts.CID_LEN + consts.LINKADRREQ.DATARATE_TXPOWER_LEN + consts.LINKADRREQ.CHMASK_LEN,
        consts.CID_OFFEST + consts.CID_LEN + consts.LINKADRREQ.DATARATE_TXPOWER_LEN + consts.LINKADRREQ.CHMASK_LEN + consts.LINKADRREQ.REDUNDANCY_LEN, false);
      output = {
        [Buffer.from([consts.LINKADR_CID], 'hex').toString('hex')]: {
          TXPower: TXPower,
          ChMask: ChMask,
          Redundancy: Redundancy,
        }
      }
    } else if (cid.readUInt8(0) === 0x04) {
      let DutyCyclePL = utils.bufferSlice(obj_buffer, consts.CID_OFFEST + consts.CID_LEN,
        consts.CID_OFFEST + consts.CID_LEN + consts.DUTYCYCLEREQ_LEN, false);
      output = {
        [Buffer.from([consts.DUTYCYCLE_CID], 'hex').toString('hex')]: {
          DutyCyclePL: DutyCyclePL,
        }
      }
    } else if (cid.readUInt8(0) === 0x05) {
      let DLSettings = utils.bufferSlice(obj_buffer, consts.CID_OFFEST + consts.CID_LEN,
        consts.CID_OFFEST + consts.CID_LEN + consts.RXPARAMSETUPREQ.DLSETTINGS_LEN, false);
      let Frequency = utils.bufferSlice(obj_buffer, consts.CID_OFFEST + consts.CID_LEN + consts.RXPARAMSETUPREQ.DLSETTINGS_LEN,
        consts.CID_OFFEST + consts.CID_LEN + consts.RXPARAMSETUPREQ.DLSETTINGS_LEN + consts.RXPARAMSETUPREQ.FREQUENCY_LEN, false);
      output = {
        [Buffer.from([consts.RXPARAMSETUP_CID], 'hex').toString('hex')]: {
          DLSettings: DLSettings,
          Frequency: Frequency,
        }
      }
    } else if (cid.readUInt8(0) === 0x06) {
      output = {
        [Buffer.from([consts.DEVSTATUS_CID], 'hex').toString('hex')]: {
        }
      }
    } else if (cid.readUInt8(0) === 0x07) {
      let ChIndex = utils.bufferSlice(obj_buffer, consts.CID_OFFEST + consts.CID_LEN,
        consts.CID_OFFEST + consts.CID_LEN + consts.NEWCHANNELREQ.CHINDEX_LEN, false);
      let Freq = utils.bufferSlice(obj_buffer, consts.CID_OFFEST + consts.CID_LEN + consts.NEWCHANNELREQ.CHINDEX_LEN,
        consts.CID_OFFEST + consts.CID_LEN + consts.NEWCHANNELREQ.CHINDEX_LEN + consts.NEWCHANNELREQ.FREQ_LEN, false);
      let DrRange = utils.bufferSlice(obj_buffer, consts.CID_OFFEST + consts.CID_LEN + consts.NEWCHANNELREQ.CHINDEX_LEN + consts.NEWCHANNELREQ.FREQ_LEN,
        consts.CID_OFFEST + consts.CID_LEN + consts.NEWCHANNELREQ.CHINDEX_LEN + consts.NEWCHANNELREQ.FREQ_LEN + consts.NEWCHANNELREQ.DRRANGE_LEN, false);
      output = {
        [Buffer.from([consts.NEWCHANNEL_CID], 'hex').toString('hex')]: {
          ChIndex: ChIndex,
          Freq: Freq,
          DrRange: DrRange,
        }
      }
    } else if (cid.readUInt8(0) === 0x08) {
      let Settings = utils.bufferSlice(obj_buffer, consts.CID_OFFEST + consts.CID_LEN,
        consts.CID_OFFEST + consts.CID_LEN + consts.RXTIMINGSETUPREQ_LEN, false);
      output = {
        [Buffer.from([consts.RXTIMINGSETUP_CID], 'hex').toString('hex')]: {
          Settings: Settings,
        }
      }
    } else if (cid.readUInt8(0) === 0x09) {
      let DwellTime = utils.bufferSlice(obj_buffer, consts.CID_OFFEST + consts.CID_LEN,
        consts.CID_OFFEST + consts.CID_LEN + consts.TXPARAMSETUPREQ_LEN, false);
      output = {
        [Buffer.from([consts.TXPARAMSETUP_CID], 'hex').toString('hex')]: {
          DwellTime: DwellTime,
        }
      }
    } else if (cid.readUInt8(0) === 0x0a) {
      let ChIndex = utils.bufferSlice(obj_buffer, consts.CID_OFFEST + consts.CID_LEN,
        consts.CID_OFFEST + consts.CID_LEN + consts.DLCHANNELREQ.CHINDEX_LEN, false);
      let Freq = utils.bufferSlice(obj_buffer, consts.CID_OFFEST + consts.CID_LEN + consts.DLCHANNELREQ.CHINDEX_LEN,
        consts.CID_OFFEST + consts.CID_LEN + consts.DLCHANNELREQ.CHINDEX_LEN + consts.DLCHANNELREQ.FREQ_LEN, false);
      output = {
        [Buffer.from([consts.DLCHANNEL_CID], 'hex').toString('hex')]: {
          ChIndex: ChIndex,
          Freq: Freq,
        }
      }
    } else if (cid.readUInt8(0) === 0x0b) {
      let Version = utils.bufferSlice(obj_buffer, consts.CID_OFFEST + consts.CID_LEN,
        consts.CID_OFFEST + consts.CID_LEN + consts.REKEYCONF_LEN, false);
      output = {
        [Buffer.from([consts.REKEY_CID], 'hex').toString('hex')]: {
          Version: Version,
        }
      }
    } else if (cid.readUInt8(0) === 0x0c) {
      let ADRparam = utils.bufferSlice(obj_buffer, consts.CID_OFFEST + consts.CID_LEN,
        consts.CID_OFFEST + consts.CID_LEN + consts.ADRPARAMSETUPREQ_LEN, false);
      output = {
        [Buffer.from([consts.ADRPARAMSETUP_CID], 'hex').toString('hex')]: {
          ADRparam: ADRparam,
        }
      }
    } else if (cid.readUInt8(0) === 0x0d) {
      let Seconds = utils.bufferSlice(obj_buffer, consts.CID_OFFEST + consts.CID_LEN,
        consts.CID_OFFEST + consts.CID_LEN + consts.DEVICETIMEANS.SECONDS_LEN, false);
      let FractionalSec = utils.bufferSlice(obj_buffer, consts.CID_OFFEST + consts.CID_LEN + consts.DEVICETIMEANS.SECONDS_LEN,
        consts.CID_OFFEST + consts.CID_LEN + consts.DEVICETIMEANS.SECONDS_LEN + consts.DEVICETIMEANS.FRACTIONALSEC_LEN, false);
      output = {
        [Buffer.from([consts.DEVICETIME_CID], 'hex').toString('hex')]: {
          Seconds: Seconds,
          FractionalSec: FractionalSec,
        }
      }
    } else if (cid.readUInt8(0) === 0x0e) {
      let ForcerRejoinReq = utils.bufferSlice(obj_buffer, consts.CID_OFFEST + consts.CID_LEN,
        consts.CID_OFFEST + consts.CID_LEN + consts.FORCEREJOINREQ_LEN, false);
      output = {
        [Buffer.from([consts.FORCEREJOIN_CID], 'hex').toString('hex')]: {
          ForcerRejoinReq: ForcerRejoinReq,
        }
      }
    } else if (cid.readUInt8(0) === 0x0f) {
      let RejoinParamSetupReq = utils.bufferSlice(obj_buffer, consts.CID_OFFEST + consts.CID_LEN,
        consts.CID_OFFEST + consts.CID_LEN + consts.REJOINPARAMSETUPREQ_LEN, false);
      output = {
        [Buffer.from([consts.REJOINPARAMSETUP_CID], 'hex').toString('hex')]: {
          RejoinParamSetupReq: RejoinParamSetupReq,
        }
      }
    } else {
      let output = {
      }
    }
    return output;
  }
};

module.exports = HttpServer;
