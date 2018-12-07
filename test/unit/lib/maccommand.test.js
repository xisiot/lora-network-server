'use strict';
const config = require('../../../config');
const dbClient = require('../../../lib/lora-lib').dbClient;
const Log = require('../../../lib/lora-lib/log');
const DbModels = require('../../../models');
const log = new Log(config.log);
const dbModels = new DbModels(dbClient);
const expect = require('chai').expect;
const HttpServer = require('../../../lib/httpServer');
const httpServer = new HttpServer(dbModels, log);

describe('Test maccommandIssuer in httpServer', () => {
  const string0x01 = '0101';
  const result_output_ResetConf = {
    '01': {
      Version: Buffer.from([1], 'hex'),
    }
  }
  it('cid = 0x01', () => {
    let output = httpServer.maccommandIssuer(string0x01);
    expect(output).to.deep.equal(result_output_ResetConf);
  });

  const string0x02 = '020102';
  const result_output_LinkCheckAns = {
    '02': {
      Margin: Buffer.from([1], 'hex'),
      GwCnt: Buffer.from([2], 'hex'),
    }
  }
  it('cid = 0x02', () => {
    let output2 = httpServer.maccommandIssuer(string0x02);
    expect(output2).to.deep.equal(result_output_LinkCheckAns);
  });

  const string0x03 = '03017a8809';
  const result_output_LinkADRReq = {
    '03': {
      TXPower: Buffer.from([1], 'hex'),
      ChMask: Buffer.from('7a88', 'hex'),
      Redundancy: Buffer.from([9], 'hex'),
    }
  }
  it('cid = 0x03', () => {
    let output3 = httpServer.maccommandIssuer(string0x03);
    expect(output3).to.deep.equal(result_output_LinkADRReq);
  });

  const string0x04 = '040a';
  const result_output_DutyCycleReq = {
    '04': {
      DutyCyclePL: Buffer.from([10], 'hex'),
    }
  }
  it('cid = 0x04', () => {
    let output4 = httpServer.maccommandIssuer(string0x04);
    expect(output4).to.deep.equal(result_output_DutyCycleReq);
  });

  const string0x05 = '050189afe7';
  const result_output_RXParamSetupReq = {
    '05': {
      DLSettings: Buffer.from([1], 'hex'),
      Frequency: Buffer.from('89afe7', 'hex'),
    }
  }
  it('cid = 0x05', () => {
    let output5 = httpServer.maccommandIssuer(string0x05);
    expect(output5).to.deep.equal(result_output_RXParamSetupReq);
  });

  const string0x06 = '06';
  const result_output_DevStatusReq = {
    '06': {
    }
  }
  it('cid = 0x02', () => {
    let output6 = httpServer.maccommandIssuer(string0x06);
    expect(output6).to.deep.equal(result_output_DevStatusReq);
  });

  const string0x07 = '078a8898af0f';
  const result_output_NewChannelReq = {
    '07': {
      ChIndex: Buffer.from('8a', 'hex'),
      Freq: Buffer.from('8898af', 'hex'),
      DrRange: Buffer.from([15], 'hex'),
    }
  }
  it('cid = 0x07', () => {
    let output7 = httpServer.maccommandIssuer(string0x07);
    expect(output7).to.deep.equal(result_output_NewChannelReq);
  });

  const string0x08 = '0807';
  const result_output_RXTimingSetupReq = {
    '08': {
      Settings: Buffer.from('07', 'hex'),
    }
  }
  it('cid = 0x08', () => {
    let output8 = httpServer.maccommandIssuer(string0x08);
    expect(output8).to.deep.equal(result_output_RXTimingSetupReq);
  });

  const string0x09 = '090a';
  const result_output_TxParamSetupReq = {
    '09': {
      DwellTime: Buffer.from([10], 'hex'),
    }
  }
  it('cid = 0x09', () => {
    let output9 = httpServer.maccommandIssuer(string0x09);
    expect(output9).to.deep.equal(result_output_TxParamSetupReq);
  });

  const string0x0a = '0a9a33056a';
  const result_output_DlChannelReq = {
    '0a': {
      ChIndex: Buffer.from('9a', 'hex'),
      Freq: Buffer.from('33056a', 'hex'),
    }
  }
  it('cid = 0x0a', () => {
    let outputa = httpServer.maccommandIssuer(string0x0a);
    expect(outputa).to.deep.equal(result_output_DlChannelReq);
  });

  const string0x0b = '0b01';
  const result_output_RekeyConf = {
    '0b': {
      Version: Buffer.from('01', 'hex'),
    }
  }
  it('cid = 0x0b', () => {
    let outputb = httpServer.maccommandIssuer(string0x0b);
    expect(outputb).to.deep.equal(result_output_RekeyConf);
  });

  const string0x0c = '0c2f';
  const result_output_ADRParamSetupReq = {
    '0c': {
      ADRparam: Buffer.from('2f', 'hex'),
    }
  }
  it('cid = 0x0c', () => {
    let outputc = httpServer.maccommandIssuer(string0x0c);
    expect(outputc).to.deep.equal(result_output_ADRParamSetupReq);
  });

  const string0x0d = '0d9fde788a88';
  const result_output_DeviceTimeAns = {
    '0d': {
      Seconds: Buffer.from('9fde788a', 'hex'),
      FractionalSec: Buffer.from('88', 'hex'),
    }
  }
  it('cid = 0x0d', () => {
    let outputd = httpServer.maccommandIssuer(string0x0d);
    expect(outputd).to.deep.equal(result_output_DeviceTimeAns);
  });

  const string0x0e = '0e98aa';
  const result_output_ForceRejoinReq = {
    '0e': {
      ForcerRejoinReq: Buffer.from('98aa', 'hex'),
    }
  }
  it('cid = 0x0e', () => {
    let outpute = httpServer.maccommandIssuer(string0x0e);
    expect(outpute).to.deep.equal(result_output_ForceRejoinReq);
  });

  const string0x0f = '0f01';
  const result_output_RejoinParamSetupReq = {
    '0f': {
      RejoinParamSetupReq: Buffer.from([1], 'hex'),
    }
  }
  it('cid = 0x0f', () => {
    let outputf = httpServer.maccommandIssuer(string0x0f);
    expect(outputf).to.deep.equal(result_output_RejoinParamSetupReq);
  });
});


after('Close connection after 50000ms', done => {
  setTimeout(() => {
    dbModels.close().then(function () {
      done();
    });
  }, 100);
});