/**
 * Author:      Evangelos Pappas
 * description:
 *
 */
var System = require("../lib/system");
var Service = require('../lib/service');
var modSender = require("../commons/modSender.js").modSender;

var nodemailer = System.nodemailer;
var redisSub = System.nodeRedis.createClient();
var redis = System.redis;
var events = require('events');
var flow = new events.EventEmitter();

var FROM_ADDR = System.conf.mail.FROM_ADDR;
var INTENSE = 1000; // time throttle
var MSGTHROTTLE = 1; // 1/sec

var service = new Service(transmitterService);
module.exports = service;

nodemailer['X_MAILER_NAME'] = System.conf.mail.headers["X_MAILER_NAME"];
nodemailer['X_MAILER_HOMEPAGE'] = System.conf.mail.headers["X_MAILER_HOMEPAGE"];

redisSub.on("subscribe", function (channel) {
    redis.publish("logger", "Sender is active", channel);
});
redisSub.on("message", function (channel, message) {
    flow.emit('pipe', JSON.parse(message));
});
redisSub.subscribe("newMail");

flow.on("pipe", function (message) {
    mSender.add({
        //messageId: message.messageId,
        from                : FROM_ADDR,
        to                  : message.to[0],
        subject             : message.subject,
        headers             : System.conf.mail.headers,
        html                : message.html
    });
});

service.on('request:lastMessage', function(deferred) {
    deferred.resolve({ });
});

function transmitterService(service) {

    redis.lpop('out', function (err, message) {
        if (err) {
            return console.log(err);
        }
        if (message) {
            flow.emit('pipe', JSON.parse(message));
        }
        service.immediate(INTENSE);
    });
}

var mSender = new modSender({
    token   : "mailbucket",
    sender  : nodemailer.createTransport("SES", {
        AWSAccessKeyID: System.conf.SES.AWSAccessKeyID,
        AWSSecretKey  : System.conf.SES.AWSSecretKey
    }),
    autoStop: false,
    throttle: {
        time : INTENSE,
        count: MSGTHROTTLE
    }
}).send(function (__this, messageID, message, target) {
        service.notify("SENDING: " + messageID);

        message.messageId = messageID;
        target.sendMail(message, function (error, response) {
            if (!error) {
                __this.sent(messageID, response);
            }
            else {
                __this.failed(messageID, response, error);
            }
            return messageID;
        });
        return messageID;
    }).onDispatch(function (__this, messageID, message) {
        service.notify("DISPATCHED: " + messageID, message);

    }).onSend(function (__this, messageID, message) {
        service.notify("SENT: " + messageID, message);
        redis.publish("logger-transmitter", "SENT: " + messageID);

    }).onQueue(function (__this, messageID, message) {
        service.notify("QUEUED: " + messageID, message);

    }).onError(function (__this, messageID, message) {
        service.notify("FAILED: " + messageID, message);

        redis.publish("logger-transmitter", "Queue " + messageID + " just FAILED!");
    }).onStop(function (__this, queue) {
        service.notify("STOPED: ", queue);

        return;
    }).start(1);
