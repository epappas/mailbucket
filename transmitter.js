/**
 * Author:      Evangelos Pappas
 * description:
 *
 */
var System = require("./lib/system").init('transmitter');
var redis = require("redis");
var nodemailer = require('nodemailer');

if (typeof setImmediate === "undefined") {
    require('setimmediate');
}

// globalize
System.nodemailer = nodemailer;
System.nodeRedis = redis;
System.redis = redis.createClient();

System.transmitter = require('./services/transmitter');
