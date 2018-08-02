'use strict';

const chai = require('chai');
const expect = chai.expect;
chai.use(require('chai-json-schema-ajv'));
const MqClient = require('../../../../lib/lora-lib/mqClient/kafka');
const Log = require('../../../../lib/lora-lib/log');

const testTopic = 'NS-sub';
const nsid = 1;
const options = {
  nsid: 1, // if exist in topic schema
  consumerGroup: {
    options: {
      kafkaHost: 'localhost:9092',
      groupId: `lora-network-server-message-dispatch-in-${nsid}`,
      sessionTimeout: 10000,
      protocol: ['roundrobin'],
      fromOffset: 'latest',
    },
    topics: [testTopic, `KafkaTest-${nsid}`],
  },
  client: {
    kafkaHost: 'localhost:9092',
    clientId: `lora-network-server-message-dispatch-out-${nsid}`,
  },
  producer: {
    requireAcks: 1,
    ackTimeoutMs: 100,
    partitionerType: 2,
  },
  topics: {
    pubToConnector: 'NC-sub',
    subFromConnector: 'NS-sub',
    pubToJoinServer: 'JS-sub',
    subFromJoinServer: 'JS-pub',
  },
};

describe('Test mqClient', function () {

  let mqClient;
  let log;
  before('create a new mqClient, and connected', function (done) {
    this.timeout(20000);
    log = new Log();
    mqClient = new MqClient(options, log);
    mqClient.connect().then(function () {
      console.log('mqClient connect, both consumer and producer');
      done();
    }).catch(function (err) {
      console.log('mqClient connect failed : ', err.message);
      done(err);
    });
  });

  it('Function getSubTopics', function () {
    expect(mqClient.getSubTopics()).to.deep.equal([testTopic, `KafkaTest-${nsid}`]);
  });

  describe('Send & listening on event "message" ', function () {
    it('should received message from topic NS-sub in 20s', function (done) {

      let pld = [{
        topic: testTopic,
        messages: 'message x',
      },
      ];
      let receivedMsgNum = 0;
      mqClient.send(pld).then(function (data) {

        expect(data).to.be.an('object');
        expect(data).to.include.keys(testTopic);
      }).catch(function (err) {
        console.error(err);
      });

      mqClient.message(function (message) {

        if (message.topic === testTopic) {

          receivedMsgNum++;
          expect(message.value).to.equal(pld[0].messages);
          if (receivedMsgNum === 1) {
            done();
          }
        }
      });
    });

  });

  describe('#send', function () {
    // it.skip('send 4 messages in diff types to topic "NS-sub"', function (done) {

    //   let pld = [{
    //     topic: testTopic,
    //     messages: 'message x',
    //   }, {
    //     topic: testTopic,
    //     messages: {
    //       msg: 'message x',
    //     },
    //   }, {
    //     topic: testTopic,
    //     messages: ['messageA', 'messageB'],
    //   }, {
    //     topic: testTopic,
    //     messages: null,
    //   },
    //   ];

    //   mqClient.send(pld).then(function (data) {
    //     console.log('    send succeed : ', data);
    //     expect(data).to.be.an('object');
    //     expect(data).to.include.keys(testTopic);
    //     done();
    //   }).catch(function (err) {
    //     console.error('    ', err);
    //   });

    // });

    describe('send invalid types of message/topic', function () {
      it('message type : number', function (done) {
        let pld = [{
          topic: testTopic,
          messages: 1,
        },
        ];
        mqClient.send(pld).then(function (data) {
          return null;
        }).catch(function (err) {
          console.error('    ', err.message);
          expect(err).to.be.an('error');
          done();
        });

      });

      it('message type : boolean', function (done) {
        let pld = [{
          topic: testTopic,
          messages: true,
        },
        ];

        mqClient.send(pld).then(function (data) {
          return null;
        }).catch(function (err) {
          console.error('    ', err.message);
          expect(err).to.be.an('error');
          done();
        });

      });

      it('message type : function', function (done) {
        let pld = [{
          topic: testTopic,
          messages: function () { return 1; },
        },
        ];

        mqClient.send(pld).then(function (data) {
          return null;
        }).catch(function (err) {
          console.error('    ', err.message);
          expect(err).to.be.an('error');
          done();
        });

      });

    });

  });

  describe('#publish', function () {
    it(`send valid message to KafkaTest-${options.nsid} `, function (done) {
      let pubMessage = {
        id: 1,
        name: 'thisIsName',
        price: 23.4,
        tag: ['tagA', 'tagB'],
      };

      mqClient.message(function (message) {

        // console.log('1received message : ', message);
        if (message.topic === `KafkaTest-${options.nsid}`) {
          expect(message.topic).to.equal(`KafkaTest-${options.nsid}`);
          expect(message.value).to.deep.equal(pubMessage);
          done();
        }
      });

      mqClient.publish(`KafkaTest-${options.nsid}`, pubMessage).then(function (res) {
        console.log('pubed', res);
      });

    });

  });

  describe('#disconnect', function () {
    it('close connection', function (done) {

      // this.timeout(10000);
      mqClient.disconnect().then(function () {
        console.log('mqclient disconnect');
        done();
      });
    });
  });

});
