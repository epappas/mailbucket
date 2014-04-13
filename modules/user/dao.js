var System = require("../../lib/system.js");
var pledge = require("../../lib/pledge.js");
var crypto = require('crypto');
var sha1 = crypto.createHash('sha1');

module.exports = (function() {

    var redis = System.redis;

    function __encrypt(pass, seed) {
        for(var i=0; i<24; ++i) pass = sha1.update(seed + pass + seed).digest('hex');

        return pass;
    }

    return {
        list: function(args) {

            return pledge(function(deferred) {
                redis.hmget("usersDB", args.keys || [], function(err, json) {
                    var tmp = JSON.parse(json);
                    if(err || !json) {
                        deferred.reject(err || "Not found keys");
                        return;
                    }
                    deferred.resolve(tmp);
                });
            });
        },
        delete: function(args) {

            return pledge(function(deferred) {
                redis.hget("usersDB", args.key, function(err, json) {
                    var tmp = JSON.parse(json);
                    if(err || !json) {
                        deferred.reject(err || "Not found " + args.key);
                        return;
                    }
                    redis.hdel("usersDB", args.key);
                    deferred.resolve({
                        key: tmp.key,
                        avatar: tmp.avatar,
                        uname: tmp.uname,
                        mail: tmp.mail
                    });
                });
            });
        },
        getCompare: function(args) {
            var key = sha1.update(args.mail).digest('hex');

            return pledge(function(deferred) {
                redis.hget("usersDB", key, function(err, json) {
                    var tmp = JSON.parse(json);

                    if (err || !json) return deferred.reject(err || "Not found " + args.mail);
                    if (!tmp.seed || !args.pass) return deferred.reject(err || "Not found " + args.mail);
                    if (tmp.pass !== __encrypt(args.pass, tmp.seed)) return deferred.reject(err || "Not found " + args.mail);

                    deferred.resolve({
                        key: tmp.key,
                        avatar: tmp.avatar,
                        uname: tmp.uname,
                        mail: tmp.mail
                    });
                });
            });
        },
        get: function(args) {

            return pledge(function(deferred) {
                redis.hget("usersDB", args.key, function(err, json) {
                    var tmp = JSON.parse(json);
                    if(err || !json) {
                        deferred.reject(err || "Not found " + args.key);
                        return;
                    }
                    deferred.resolve({
                        key: tmp.key,
                        avatar: tmp.avatar,
                        uname: tmp.uname,
                        mail: tmp.mail
                    });
                });
            });
        },
        put: function(args) {

            var seed = Math.round(Math.random() * 100000).toString(24);
            var item = {
                key: sha1.update(args.mail).digest('hex'),
                pass: __encrypt(args.pass, seed),
                mail: args.mail,
                uname: args.mail,
                seed: seed,
                geolocation: args.geolocation || { lat: 0, lon: 0},
                address: args.address || '',
                avatar: args.avatar || ''
            };
            return pledge(function(deferred) {
                redis.hget("usersDB", item.key, function(err, json) {
                    var tmp = JSON.parse(json);
                    if(err) {
                        deferred.reject(err);
                        return;
                    }
                    tmp = {
                        key: item.key,
                        pass: item.pass,
                        uname: item.uname,
                        mail: item.mail,
                        seed: item.seed,
                        geolocation: item.geolocation,
                        address: item.address,
                        avatar: item.avatar
                    };
                    redis.hset("usersDB", tmp.key, JSON.stringify(tmp));
                    deferred.resolve(tmp.key);
                });
            });
        }
    };
});
