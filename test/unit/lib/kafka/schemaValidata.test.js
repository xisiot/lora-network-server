'use strict';

const expect = require('chai').expect;
const SchemaValidate = require('../../../../lib/lora-lib/mqClient/kafka/schema');
const aa = require('../../../../config/');
const options = {
  nsid: 1,
};
const topic = `KafkaTest-${options.nsid}`;

let msgSchema;

describe('Message Json Schema Test', function () {

  it('#new Schema', function () {
    msgSchema = new SchemaValidate(options);
    expect(msgSchema).to.include.keys('map');
    expect(msgSchema.map).to.include.keys(topic);
  });

  describe('#match & #errorsText', function () {

    let matchRes;
    let validate;
    let message = {
      id: 1,
      name: 'thisIsName',
      price: 23.4,
      tag: ['tagA', 'tagB'],
    };
    let errorMsg;

    before('match func should have keys of "schema", "validate" ', function () {
      matchRes = msgSchema.match(topic);
      expect(matchRes).to.include.keys('schema');
      expect(matchRes).to.include.keys('validate');
      validate = matchRes.validate;
    });

    it('message should be valid', function () {
      expect(validate(message)).to.be.true;
    });

    it('should be "No errors"', function () {
      errorMsg = msgSchema.errorsText(validate);
      expect(msgSchema.errorsText(validate)).to.equal('No errors');
    });

    it('message should be invalid', function () {
      message.price = -1;
      expect(validate(message)).to.be.false;
    });

    it('should print error log', function () {
      errorMsg = msgSchema.errorsText(validate);
      console.log('       ', errorMsg);
      expect(msgSchema.errorsText(validate)).to.not.equal('No errors');
    });

  });

});
