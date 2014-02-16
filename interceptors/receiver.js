var System = require("../lib/system");
var pledge = require("../lib/pledge");
var mediator = require("../lib/mediator");
var crypto = require('crypto');

var receiver = module.exports = mediator.extent("receiver");

if (typeof setImmediate === "undefined") {
    require('setimmediate');
}

receiver.incoming = exports.incoming = function(message, callback) {
    var tokenKey = System.getUuid();
    var headers = message.headers || { };
    var envelope = message.envelope || { };
    // map alias mail addr
    System.redis.hget("mail_alias", envelope.to, function (err, result) {
        if (err || result === null) {
            console.log(err);
            callback(new Error("Internal Error::71356"), null);
            return;
        }
        var mainAlias = result;
        var uKey = crypto.createHash('md5').update(mainAlias).digest('hex');
        // check fot the existence of the user
        System.redis.hexists("users_repo", uKey, function (err, result) {
            if (result === 1) {
                callback(null, {token: tokenKey});

                receiver.publish('message', {
                    token     : tokenKey,
                    uKey      : uKey,
                    subject   : headers.Subject,
                    from      : headers.From,
                    to        : mainAlias,
                    filename  : (tokenKey) + ".json",
                    recipients: envelope.recipients ? envelope.recipients : [],
                    body      : (message.html ? message.html : (message.plain ? message.plain : "")),
                    bodyParsed: (message.plain ? message.plain : ""),
                    message   : message,
                    err       : message.responce
                });
            }
            else {
                callback(new Error("User Not Exists"), null);
            }
        });
    });
};

receiver.subscribe("incoming", function(message, callback) {
    receiver.incoming(message, callback);
});

receiver.subscribe('message', function (message) {
    pledge(message)
    // push message to user list userKey_in
    .then(function (message, next) {
        System.redis.rpush(message.uKey + "_in", JSON.stringify(message), function (err) {
            if (err) {
                console.error(err);
                return;
            }
            next(message.uKey);
        });
    })
    // publish new notification
    .then(function (uKey) {
        System.redis.publish("newMessage", uKey);
    });
});
