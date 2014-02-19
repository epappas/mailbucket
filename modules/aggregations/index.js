var pledge = require("../../lib/pledge.js");
var aggregationDAO = require("./dao");

module.exports = (function() {


    var aggregation = aggregationDAO();

    return {
        storeAggregationDetail: function(token, message) {
            return pledge(function(deffered) {
                aggregation.putDetail(token, message, function(err, rows) {
                    if(err) return deffered.reject(err);
                    deffered.resolve(rows);
                });
            });
        },
        storeAggregation: function(email) {
            return pledge(function(deffered) {
                aggregation.put(email, function(err, rows) {
                    if(err) return deffered.reject(err);
                    deffered.resolve(rows);
                });
            });
        }
    };
});
