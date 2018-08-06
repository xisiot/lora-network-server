// import the necessary modules
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// define schema
const MongoSavedMsg = new Schema({
  DevAddr: String,
  gatewayId: String,
  msgType: String,
  createdTime: Number,
  data: Object,
});

module.exports = MongoSavedMsg;