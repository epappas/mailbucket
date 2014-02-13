var Q = require('q');

var uuid = require('./uuid');

module.exports = (function(args) {

    var postponePTR, options = { };
    var usid = uuid.get('xxxxxxxxxxxx');
    var redis = null;
    var LOCK_SPIN = 0;
    var states = {
        LOCKED: 0,
        RUNNING: 1,
        DEAD: 2
    };


    if(arguments.length > 2) {
        options = {
            redis: arguments[0],
            namespace: arguments[1] || 'lock',
            usid: arguments[2] || usid,
            retryDelay: arguments[3] || 1000
        };
    }
    else {
        options = {
            redis: args.client,
            namespace: args.namespace || 'lock',
            usid: args.usid || usid,
            retryDelay: args.retryDelay || 1000
        };
    }

    redis = options.redis;
    LOCK_SPIN = Math.floor(options.retryDelay / 5);

    function Seal(key, task) {
        this.state = states.LOCKED;
        return this.tick.call(this, options.namespace + ':'  + key, task);
    }

    Seal.prototype.stop = function() {
        this.state = states.DEAD;
        return this;
    };

    Seal.prototype.tick = function(lockKey, task) {
        if(this.state === states.DEAD) return;
        var self = this;

        // first just check any lock existence
        return Q.nfcall(redis.get.bind(redis), lockKey)
        .then(function(lockedUID) {
            // if the ownership of lock is mine
            // or in lock absence, priority is given to the last active
            if(lockedUID == options.usid || self.state === states.RUNNING) {
                // renew TTL, as this service is still alive and owns the lock
                return Q.nfcall(retain, lockKey, LOCK_SPIN, options.usid);
            }
            else { // in any case double check with time padding
                return delayedCheckLock(lockKey);
            }
        })
        .then(function(proceed) {
            if(!proceed) return; // madness barier
            if(self.state === states.RUNNING) return;

            self.state = states.RUNNING; // if here is reached, I must be the owner
            task(function() {
                self.state = states.LOCKED;

                return Q.nfcall(redis.del.bind(redis), lockKey, options.usid)
                .then(nextSpin.bind(self, LOCK_SPIN, lockKey, task));
            }.bind(self));
        })
        .then(nextSpin.bind(self, LOCK_SPIN, lockKey, task))
        .fail(nextSpin.bind(self, options.retryDelay, lockKey, task));
    };

    function postpone(time) {
        var deferred = Q.defer();

        clearTimeout(postponePTR);
        postponePTR = setTimeout(function() {
            deferred.resolve();
        }, time);

        return deferred.promise;
    }

    // check and lock
    function lock(lockKey, uid, callback) {
        return Q.nfcall(redis.setnx.bind(redis), lockKey, uid)
        .then(function(result) {
            callback(null, result === 1);
        })
        .fail(function(err) {
            callback(err, false);
        });
    }

    function retain(lockKey, time, uid, callback) {
        time = Math.max(1, Math.floor(time / 1000));

        redis.multi([
            ['del', lockKey],
            ['setex', lockKey, time, uid]
        ]).exec(function (err, replies) {
            if(err) callback(err, replies);
            callback(null, replies);
        });
    }

    function doubleCheckLock(lockKey) {
        // try to lock
        return Q.nfcall(lock, lockKey, options.usid)
        .then(function(isAcquired) {
            if(!isAcquired) throw 'missed the race';
            // if locked, expiration is set
            return Q.nfcall(redis.pexpire.bind(redis), lockKey, LOCK_SPIN);
        });
    }

    function delayedCheckLock(lockKey) {
        // recheck with delay, to void any race condition
        return postpone(qTime(LOCK_SPIN))
        .then(function() {
            // try to lock
            return doubleCheckLock(lockKey);
        });
    }

    function nextSpin(delay, lockKey, task) {
        var self = this;
        return postpone(delay)
        .then(function() {
            self.tick(lockKey, task);
        });
    }

    // time + quantum
    function qTime(time) {
        return time + Math.floor(Math.random() * 10);
    }

    return function(key, task) {
        new Seal(key, task);
    };
});
