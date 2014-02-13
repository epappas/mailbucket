var Q = require("q");
var System = require("../../lib/system.js");
var pledge = require("../../lib/pledge.js");

if (typeof setImmediate === "undefined") {
    require('setimmediate');
}

module.exports = (function(redis, memcached) {

    return {
        list: function(args) {
            var __this = this;
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
            var __this = this;
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
        get: function(args) {
            var __this = this;
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
            var __this = this;
            var seed = Math.round(Math.random()*100000).toString(24);
            var item = {
                key: md5.update(args.mail).digest('hex'),
                pass: md5.update(seed + args.pass + seed).digest('hex'),
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
