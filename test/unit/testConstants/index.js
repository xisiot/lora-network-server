const consts = require('../../../lib/lora-lib/constants');
const devAddr = '03156354';
const gatewayId = 'bbbbbbbbbbbbbbbb';
const gatewayId2 = 'aaaaaaaaaaaaaaaa';
const userID = 'test123456';

module.exports = new class {

  constructor() {
    this.testDeveloper = {
      developer_id: userID,
      email: 'qweasd@163.com',
      password: 'e10adc3949ba59abbe56e057f20f883e',
      is_login: false,
      name: 'test',
      time: new Date().getSeconds(),
    };

    this.testApp = {
      AppEUI: Buffer.alloc(consts.APPEUI_LEN),
      userID: userID,
      name: 'testApp',
    };

    this.testDeviceInfo = {
      DevEUI: Buffer.alloc(consts.DEVEUI_LEN),
      DevAddr: Buffer.alloc(consts.DEVADDR_LEN, devAddr, 'hex'),
      AppKey: Buffer.from('2B7E151628AED2A6ABF7158809CF4F3C', 'hex'),
      AppEUI: Buffer.alloc(consts.APPEUI_LEN),
      DevNonce: '',
      AppNonce: '',
      NwkSKey: Buffer.from('2B7E151628AED2A6ABF7158809CF4F3C', 'hex'),
      AppSKey: Buffer.from('2B7E151628AED2A6ABF7158809CF4F3C', 'hex'),
      activationMode: 'OTAA',
      FCntUp: 0,
      NFCntDown: 0,
      AFCntDown: 0,
    };

    this.testDeviceConfig = {
      DevAddr: Buffer.alloc(consts.DEVADDR_LEN, devAddr, 'hex'),
      frequencyPlan: consts.FREQUENCY_PLAN_LIST[0],
      ADR: true,
      ADR_ACK_LIMIT: 64,
      ADR_ACK_DELAY: 32,
      ChMask: '00FF',
      CFList: '330A6833029832FAC832F2F832EB2832E35832DB8832D3B8',
      ChDrRange: '5050505050505050',
      RX1CFList: '330A6833029832FAC832F2F832EB2832E35832DB8832D3B8',
      RX1DRoffset: 4,
      RX1Delay: 1,
      RX2Freq: 434.665,
      RX2DataRate: 0,
      NbTrans: 1,
      MaxDCycle: 1,
      MaxEIRP: 12.15,
    };

    this.testDeviceRouting = {
      DevAddr: Buffer.alloc(consts.DEVADDR_LEN, devAddr, 'hex'),
      gatewayId: Buffer.alloc(consts.GATEWAYID_LEN, gatewayId, 'hex'),
      tmst: 1176651636,
      freq: 433.3,
      powe: 25,
      datr: 'SF12BW125',
      modu: 'LORA',
      codr: '4/5',
    };

    this.testDeviceStatus = {
      DevAddr: Buffer.alloc(consts.DEVADDR_LEN, devAddr, 'hex'),
      tmst: 1231234,
      freq: 433.2,
      chan: 1,
      rfch: 0,
      stat: 1,
      modu: 'LORA',
      datr: 'SF7BW125',
      codr: '4/5',
      rssi: -123,
      lsnr: 0,
      gatewayId: Buffer.alloc(consts.GATEWAYID_LEN, gatewayId, 'hex'),
    };

    this.testGatewayInfo = {
      gatewayId: Buffer.alloc(consts.GATEWAYID_LEN, gatewayId, 'hex'),
      userID: userID,
      type: 'indoor',
      frequencyPlan: 'China 433MHz',
      location: '(116E,39N)',
      model: 'X01',
      RFChain: 0,
    };

    this.testGatewayStatus = {
      gatewayId: Buffer.alloc(consts.GATEWAYID_LEN, gatewayId, 'hex'),
      time: '2014-01-12 08:59:28 GMT',
      lati: 46.24000,
      long: 3.25230,
      alti: 145,
      rxnb: 2,
      rxok: 2,
      rxfw: 2,
      ackr: 100.0,
      dwnb: 2,
      txnb: 2,
    };

    this.uplinkRxInfoArr = [{
      DevAddr: Buffer.alloc(consts.DEVADDR_LEN, devAddr, 'hex'),
      tmst: 1231234,
      freq: 433.2,
      chan: 1,
      rfch: 0,
      stat: 1,
      modu: 'LORA',
      datr: 'SF7BW125',
      codr: '4/5',
      rssi: -100,
      lsnr: 1,
      gatewayId: Buffer.alloc(consts.GATEWAYID_LEN, gatewayId, 'hex'),
    }, {
      DevAddr: Buffer.alloc(consts.DEVADDR_LEN, devAddr, 'hex'),
      tmst: 65432112,
      freq: 433.2,
      chan: 1,
      rfch: 0,
      stat: 1,
      modu: 'LORA',
      datr: 'SF7BW125',
      codr: '4/5',
      rssi: -123,
      lsnr: 0,
      gatewayId: Buffer.alloc(consts.GATEWAYID_LEN, gatewayId2, 'hex'),
    },
    ];
    this.uplinkAppObj = {
      MHDR: {
        'MType': 4,
        'Major': 0,
      },
      MACPayload: {
        'FHDR': {
          'DevAddr': devAddr,
          'FCtrl': { 'ADR': 1, 'ADRACKReq': 0, 'ACK': 0, 'ClassB': 0, 'FOptsLen': 0 },
          'FCnt': Buffer.from('00000001', 'hex'),
          'FOpts': Buffer.from('', 'hex'),
        },
        'FPort': Buffer.from('02', 'hex'),
        'FRMPayload': Buffer.from('0801100018d00f', 'hex'),
      },
      MIC: Buffer.from('5ff618da', 'hex'),
      version: '02',
      FCntUp: 1,
      srcID: '',
    };
    this.downlinkDataMsgQueueInRedis = {

      //Unprocessed raw data
      data: 'FFFFFF',

      //Processed data & Used data
      pbData: 'FFFFFF',

      //Aggregation times
      aggregation: 0,
    };
    this.uplinkCompleteData = {
      'version': '02',
      'token': '71ed',
      'identifier': '00',
      'gatewayId': gatewayId,
      'rxpk': {
        'tmst': 1997876292,
        'chan': 5,
        'rfch': 0,
        'freq': 433.5,
        'stat': 1,
        'modu': 'LORA',
        'datr': 'SF9BW125',
        'codr': '4/5',
        'lsnr': 12.2,
        'rssi': -95,
        'size': 29,
        'data': {
          'MHDR': {
            'MType': 4,
            'Major': 0,
          },
          'MACPayload': {
            'FHDR': {
              'DevAddr': devAddr,
              'FCtrl': {
                'ADR': 1,
                'ADRACKReq': 0,
                'ACK': 0,
                'ClassB': 0,
                'FOptsLen': 0,
              },
              'FCnt': '00000001',
              'FOpts': [],
            },
            'FPort': '02',
            'FRMPayload': 'ffffffff0028002c0000000000000806',
          },
          'MIC': 'd03f5819',
        },
        'raw': 'gFNjBACAAQAC1m/D3J54E002KLwWqu9hLdA/WBk=',
      },
    };
    this.fromJoinServerMsg = {
      'version': '02',
      'token': '9bb4',
      'identifier': '00',
      'gatewayId': gatewayId,
      'rxpk': {
        'tmst': 144593516,
        'chan': 7,
        'rfch': 0,
        'freq': 433.9,
        'stat': 1,
        'modu': 'LORA',
        'datr': 'SF12BW125',
        'codr': '4/5',
        'lsnr': -7.3,
        'rssi': -101,
        'size': 23,
        'data':
          {
            'MHDR': {
              'MType': 0,
              'Major': 0,
            },
            'MHDRRaw': '00',
            'MACPayload': 'f4ad3c9425ca0851ff204d0c5f0dbe8e5d77',
            'MIC': 'b3cb059e',
          },
        'raw': 'APStPJQlyghR/yBNDF8Nvo5dd7PLBZ4=',
      },
    };
    this.delOpts = {
      developer_id: userID,
    };
  }
}();
