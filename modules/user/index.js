var System = require("../../lib/system");
var userDAO = require("./dao");

if (typeof setImmediate === "undefined") {
    require('setimmediate');
}

module.exports = (function(redis, memcached) {

    var user = userDAO(redis, memcached);

    return {
        list: function(req, res, callback) {
            return user.list(req)
                .then(function(users) {
                    setImmediate(callback.bind(null, users));
                });
        }
    };
});
