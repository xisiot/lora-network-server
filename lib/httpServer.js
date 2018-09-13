const crypto = require('crypto');
const Koa = require('koa');
const route = require('koa-route');
const bodyParser = require('koa-bodyparser');

const HttpServer = class {
  constructor(dbModels, log) {
    this.log = log;
    this.dbModels = dbModels;
    this.mysqlConn = this.dbModels.mysqlConn;
    this.Developers = this.mysqlConn.Developers;
    this.AppInfo = this.mysqlConn.AppInfo;
    this.DeviceInfo = this.mysqlConn.DeviceInfo;
    this.app = new Koa();
  }

  bind(config) {
    this.config = config;
    this.app.use(bodyParser());
    this.register();
    this.login();
    this.application();
    this.device();
    this.app.listen(this.config.http.port);
  }

  register() {
    const register = async ctx => {
      const { email, password } = ctx.request.body;
      const query = {
        email: email,
        password: password,
        developer_id: crypto.randomBytes(16),
        name: email,
        time: Date.now() / 1000
      };
      try {
        await this.Developers.createItem(query)
          .then(() => {
            ctx.response.body = 'success';
          });
      } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
          ctx.response.body = 'user already registed';
        } else {
          ctx.response.body = { 'message': error.message };
        }
      }
    };
    this.app.use(route.post('/register', register));
  }

  login() {
    const login = async ctx => {
      const { email, password } = ctx.request.body;
      const whereOpts = {
        email: email
      };
      try {
        await this.Developers.readItem(whereOpts, ['password', 'developer_id'])
          .then((res) => {
            if (res.password === password) {
              ctx.response.body = { 'userID': res.developer_id };
            } else if (res.password === null) {
              ctx.response.body = 'user not registed';
            } else {
              ctx.response.body = 'user password error';
            }
          });
      } catch (error) {
        ctx.response.body = { 'message': error.message };
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
      try {
        await this.AppInfo.createItem(query)
          .then(() => {
            ctx.response.body = 'success';
          });
      } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
          ctx.response.body = 'application already created';
        } else if (error.name === 'SequelizeForeignKeyConstraintError') {
          ctx.response.body = 'user not registed';
        } else {
          ctx.response.body = { 'message': error.message };
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
      try {
        await this.DeviceInfo.createItem(query)
          .then(() => {
            ctx.response.body = 'success';
          });
      } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
          ctx.response.body = 'device already created';
        } else if (error.name === 'SequelizeForeignKeyConstraintError') {
          ctx.response.body = 'application not created';
        } else {
          ctx.response.body = { 'message': error.message };
        }
      }
    };
    this.app.use(route.post('/device', device));
  }
};

module.exports = HttpServer;
