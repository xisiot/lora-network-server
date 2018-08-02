'use strict';
const Sequelize = require('sequelize');
const Redis = require('ioredis');
const config = require('../../config');

const newMysqlConnection = function () {
  const opts = config.database.mysql;
  const Seq = new Sequelize(
    opts.database,
    opts.username,
    opts.password,
    opts
  );
  return Seq;
};

const newRedisConnection = function () {
  const opts = config.database.redis;
  const redis = opts.cluster ?
    new Redis.Cluster(opts) :
    new Redis(opts);

  redis.once('connect', function (err) {
    redis.client('setname', `${process.pid}.db`);
  });

  return redis;
};

const createDBClient = function (dbName) {
  if (dbName === 'mysql') {
    return newMysqlConnection();
  } else if (dbName === 'redis') {
    return newRedisConnection();
  }

  return new Error('No such DB Client');
};

module.exports = createDBClient;
