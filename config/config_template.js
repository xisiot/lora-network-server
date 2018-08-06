// This is a template config file
// Please COPY this file when deploying a new server
'use strict';

//Network-server identifier
const nsid = 1;

module.exports = {

  //Database settings
  database: {
    mysql: {
      username: 'username',
      password: 'password',
      database: 'mysql',
      host: 'localhost',
      port: 3306,
      dialect: 'mysql',
      operatorsAliases: false,
      logging: false,
      timezone: '+08:00',
      define: {
        'freezeTableName': true,
        'timestamp': true,
        'charset': 'utf8',
      },
    },
    redis: {
      cluster: false,
      options: [{
        host: 'localhost',
        port: 6379,
        retryStrategy: function (times) {
          var delay = Math.min(times * 50, 30000);
          if (delay >= 30000) {
            console.log('---------------Redis Retry close---------------');
            return 'close';
          }
          return delay;
        }
      }],
    },
    mongodb: {
      host: 'localhost',
      port: 27017,
      db: 'loraLogger',
      cluster: false,
    },
  },

  //Test file setting
  mocha: {
    timeout: 5000,
    longTimeOut: 15000,
  },

  //Kafka consumer & producer setting
  msgQueue: {
    nsid: `${nsid}`, // if exist in topic schema
    consumerGroup: {
      options: {
        kafkaHost: 'localhost:9092',
        groupId: `lora-network-server-message-dispatch-in-${nsid}`,
        sessionTimeout: 15000,
        protocol: ['roundrobin'],
        fromOffset: 'latest'
      },
      topics: ['NS-sub', 'AS-pub', 'JS-pub']
    },
    client: {
      kafkaHost: 'localhost:9092',
      clientId: `lora-network-server-message-dispatch-out-${nsid}`
    },
    producer: {
      requireAcks: 1,
      ackTimeoutMs: 100,
      partitionerType: 2
    },

    //Custom shema to verify packet validity. Not used in server.
    schemaPath: {
      messages: 'config/messages.json',
      common: 'config/common.json'
    },

    //Kafka topics for receiving and sending data
    topics: {
      pubToApplicationServer: 'AS-sub',
      subFromApplicationServer: 'AS-pub',
      pubToConnector: 'NC-sub',
      subFromConnector: 'NS-sub',
      pubToJoinServer: 'JS-sub',
      subFromJoinServer: 'JS-pub',
      pubToControllerServer: 'CS-sub',
      subFromControllerServer: 'CS-pub'
    },
  },

  //winston logger setting
  log: {
    level: 'debug',
    colorize: true,
  },

  //LoRa network-server setting
  server: {
    /*
    Set whether to enable FCnt check
    */
    fcntCheckEnable: true,
    /*
    Waiting time for Uplink package de-duplication
    Unit: milliseconds(ms)
    */
    deduplication_Delay: 200,
    /*
    Waiting time for downlink package processing
    Unit: milliseconds(ms)  
    */
    downlink_Data_Delay: 200,//ms
  },
};
