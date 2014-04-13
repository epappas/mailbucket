var System = require("../lib/system");
var pledge = require("../lib/pledge");
var mediator = require("../lib/mediator");

module.exports = mediator.extent("token");

module.exports.tokenize = function(key, token) {
    key = "token:" + key;

    return pledge(function(deferred) {
        System.redis.set(key, JSON.stringify(token), function(err, ressult) {
            if (err) {
                console.error(err, ressult);
                return deferred.reject(err);
            }
            if (!ressult) {
                return deferred.reject(false);
            }
            return deferred.resolve(key);
        });
    });
};

module.exports.untokenize = function(req, res, next) {

    var key = (req.params && req.params.token || req.body && req.body.token || false);

    if(!key) return (typeof next === 'function' ? next() : pledge({ }));

    key = "token:" + key;

    return pledge(function(deferred) {
        System.redis.get(key, function(err, ressult) {
            if (err) {
                console.error(err, ressult);
                if (typeof next === 'function') return next(err);

                return deferred.reject({
                    code: 500,
                    message: "Server's failure"
                });
            }
            if (!ressult) {
                if (typeof next === 'function')  return next(new Error('No token was found'));

                return deferred.reject({
                    code: 400,
                    message: "User is not logged in"
                });
            }

            req.token = JSON.parse(ressult) || { };

            if (typeof next === 'function') return next(null, req.token);

            return deferred.resolve(req, res, next);
        });
    });
};
