var Q = require('q');

var uuid = require('./uuid');

module.exports = (function(args) {

    var options = { };
    var usid = uuid.get('xxxxxxxxxxxx');
    var redis = null;

    if(arguments.length > 2) {
        options = {
            redis: arguments[0],
            namespace: arguments[1] || 'lock',
            usid: arguments[2] || usid,
            retryDelay: arguments[3] || 50
        };
    }
    else {
        options = {
            redis: args.client,
            namespace: args.namespace || 'lock',
            usid: args.usid || usid,
            retryDelay: args.retryDelay || 50
        };
    }

    redis = options.redis;

    function Try(key, task) {
        return this.tick.call(this, options.namespace + ':'  + key, task);
    }

    Try.prototype.tick = function(lockKey, task) {
        var self = this;

        // first just check any lock existence
        return Q.nfcall(redis.watch.bind(redis), lockKey)
        .then(function() {
            return Q.nfcall(redis.get.bind(redis), lockKey);
        })
        .then(function(uid) {
            if(uid) throw 'locked out';

            return Q.nfcall(__lock, lockKey, options.usid);
        })
        .then(function(proceed) {
            if(!proceed) return; // madness barier

            // if here is reached, I must be the owner
            task(function() {
                return redis.del(lockKey);
            }.bind(self));
        });
    };

    // check and lock
    function __lock(lockKey, uid, callback) {
        redis.multi()
        .setnx(lockKey, uid)
        .exec(function(err, results) {
            if(err || !results) callback(true, null);
            callback(null, true);
        });
    }

    return function(key, time, task) {
        if(typeof time === 'function' && !task) {
            task = time;
            time = 0;
        }
        new Try(key, time, task);
    };
});
