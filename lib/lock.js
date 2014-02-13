var Q = require('q');

var uuid = require('./uuid');

module.exports = (function(args) {

    var options = { };
    var usid = uuid.get('xxxxxxxxxxxx');
    var redis = null;
    var LOCK_SPIN = 0;

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
    LOCK_SPIN = Math.floor(options.retryDelay / 5);

    function Lock(key, time, task) {
        return this.tick.call(this, options.namespace + ':'  + key, time, task);
    }

    Lock.prototype.tick = function(lockKey, time, task) {
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
            if(time) redis.pexpire(lockKey, time);

            // if here is reached, I must be the owner
            task(function() {
                return redis.del(lockKey);
            }.bind(self));
        })
        // retry to acquire
        .fail(nextSpin.bind(self, options.retryDelay, lockKey, time, task));
    };

    function postpone(time) {
        var deferred = Q.defer();

        setTimeout(function() {
            deferred.resolve();
        }, time);

        return deferred.promise;
    }

    // check and lock
    function __lock(lockKey, uid, callback) {
        redis.multi()
        .setnx(lockKey, uid)
        .exec(function(err, results) {
            if(err || !results) callback(true, null);
            callback(null, true);
        });
    }

    function nextSpin(delay, lockKey, time, task) {
        var self = this;
        return postpone(delay)
        .then(function() {
            self.tick(lockKey, time, task);
        });
    }

    return function(key, time, task) {
        if(typeof time === 'function' && !task) {
            task = time;
            time = 0;
        }
        new Lock(key, time, task);
    };
});
