
var user = require("../interceptors/user.js");

module.exports = (function(System, app) {

	app.post('/users/list', function(req, res, next) {
		user.ctrl.list(req, res, function(err, list) {
				if (list) {
					res.send(list);
					res.end();
					return;
				}
				next(null);
			});
	});

});
