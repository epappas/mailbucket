
module.exports = (function(connect) {

    // Connect's Store
    var ConnectStore = connect.session.Store;

    function RedisStore(options) {
        var self = this;

        options = options || { };
        ConnectStore.call(this, options);
        this.namespace = (options.namespace ? 'user:session:' : options.namespace);

        this.client = options.client || new require('redis').createClient(options.port || options.socket, options.host, options);

        if (options.pass) {
            this.client.auth(options.pass, function(err){
                if (err) throw err;
            });
        }

        this.ttl = options.ttl || (24 * 60 * 60);

        if (options.db) {
            this.client.select(options.db);
            this.client.on("connect", function() {
                self.client.send_anyways = true;
                self.client.select(options.db);
                self.client.send_anyways = false;
            });
        }

        this.client.on('error', function () { self.emit('disconnect'); });
        this.client.on('connect', function () { self.emit('connect'); });

        return this;
    }

    RedisStore.prototype = ConnectStore.prototype;

    RedisStore.prototype.get = function(sid, fn) {
        sid = this.namespace + sid;

        this.client.get(sid, function(err, data){
            if (err) return fn(err);
            if (!data) return fn();

            fn(null, JSON.parse(data));
        });
    };

    RedisStore.prototype.set = function(sid, sess, fn){
        sid = this.namespace + sid;
        this.client.setex(sid, this.ttl, JSON.stringify(sess), function(err) {
            if(err || !fn) return;
            fn.apply(this, arguments);
        });
    };

    RedisStore.prototype.destroy = function(sid, fn){
        sid = this.namespace + sid;
        this.client.del(sid, fn);
    };

    return RedisStore;
});
