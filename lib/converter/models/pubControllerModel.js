'use strict';

class PubControllerModel {
  constructor(rxInfoArr, adr, macCmdArr) {
    this.DevAddr = rxInfoArr[0].DevAddr;
    if (macCmdArr) {
      this.data = macCmdArr;
    }

    this.devtx = {
      freq: rxInfoArr[0].freq,
      datr: rxInfoArr[0].datr,
      codr: rxInfoArr[0].codr,
    };
    this.adr = adr;
    this.gwrx = [];
    rxInfoArr.forEach((element, index) => {
      let oneGwrx = {};
      oneGwrx.gatewayId = element.gatewayId;
      oneGwrx.time = element.time;
      oneGwrx.tmms = element.tmms;
      oneGwrx.tmst = element.tmst;
      oneGwrx.chan = element.chan;
      oneGwrx.rfch = element.rfch;
      oneGwrx.stat = element.stat;
      oneGwrx.modu = element.modu;
      oneGwrx.rssi = element.rssi;
      oneGwrx.lsnr = element.lsnr;
      oneGwrx.size = element.size;
      this.gwrx.push(oneGwrx);
    });
  }

  getDevAddr() {
    return this.DevAddr;
  }

  getCMDdata() {
    return this.data ? this.data : [];
  }

  getadr() {
    return this.adr;
  }

  getdevtx() {
    return this.devtx;
  }

  getgwrx() {
    return this.gwrx;
  }
}

module.exports = PubControllerModel;
