var System = require("../lib/system");
var pledge = require("../lib/pledge");
var crypto = require('crypto');

if (typeof setImmediate === "undefined") {
	require('setimmediate');
}

module.exports.ctrl = require("../modules/user")(System.redis, System.memcached);

module.exports.auth = function(express) {

	return express.basicAuth(function(user, pass, next) {
		var md5 = crypto.createHash('md5');
		var userHash = md5.update(user).digest('hex');
		var passHash = md5.update(pass).digest('hex');

		System.memcached.get(userHash, function(err, ressult) {
			if (err) {
				console.error(err, ressult);
				next(err);
				return;
			}
			if (!ressult || passHash === md5.update(ressult || "").digest('hex')) {
				// user doesn't exists
				next({});
				return;
			}
			next(null, true);
		});
	});
};

module.exports.tokenizeReq = function(key, token) {
	key = "token:" + key;
	return pledge(function(deferred) {
		System.memcached.set(key, JSON.stringify(token), function(err, ressult) {
			if (err) {
				console.error(err, ressult);
				return deferred.reject(err);
			}
			if (!ressult) {
				return deferred.reject(false);
			}
			return deferred.resolve(true);
		});
	});
};

module.exports.untokenizeReq = function(req, res, next) {

	var key = (req.params.token || req.body.token || false);

	if(!key) return (typeof next === 'function' ? next() : pledge({ }));

	key = "token:" + key;

	return pledge(function(deferred) {
		System.memcached.get(key, function(err, ressult) {
			if (err) {
				console.error(err, ressult);
				if (typeof next === 'function') return next(err);

				return deferred.reject({
					code: 500,
					message: "Server's failure"
				});
			}
			if (!ressult) {
				if (typeof next === 'function')  return next(null);

				return deferred.reject({
					code: 400,
					message: "User is not logged in"
				});
			}

			req.token = JSON.parse(ressult) || { };

			if (typeof next === 'function') return next(req.token);

			return deferred.resolve(req, res, next);
		});
	});
};
