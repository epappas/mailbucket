
var receiver = require("../interceptors/receiver.js");

module.exports = (function(System, app) {

    app.all('/incoming', function (req, res, next) {
        receiver.publish('incoming', req.body || { }, function(err, data) {
            if(err) next(err);
            res.send(data);
            res.end();
        });
    });
});
