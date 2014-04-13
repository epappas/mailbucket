var mediator = require("../lib/mediator");

var model = require("../modules/user");

module.exports = mediator.extent("user");

module.exports.auth = function(express) {

	return express.basicAuth(function(userKey, pass, next) {
		model().getCompare(userKey, pass, function(err, user) {
			if(err) return next(err);
			if(!user.isAdmin)  return next(new Error());

			next(null, true);
		});
	});
};

module.exports.login = function(req, res, next) {
	var mail = req.body['email'];
	var pass = req.body['pass'];

	model().getCompare(mail, pass, function(err, user) {
		if(err) return next(err);
		if(!user.isAdmin)  return next(new Error());

		req.session = req.session || {};
		req.session.user = user;
		req.session.uKey = user.key;
		req.user = user;

		next();
	});
};
