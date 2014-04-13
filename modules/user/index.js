var userDAO = require("./dao");

module.exports = (function() {

    var user = userDAO();

    return {
        list: function(req, res, callback) {
            return user.list(req)
            .then(function(users) {
                setImmediate(callback, null, users);
            });
        },
        getCompare: function(mail, pass, callback) {
            return user.getCompare({mail: mail, pass: pass})
            .then(function(user) {
                setImmediate(callback, null, user);
            })
            .onError(function(err) {
                setImmediate(callback, err, null);
            });
        }
    };
})();
