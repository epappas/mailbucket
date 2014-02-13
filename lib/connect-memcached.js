
module.exports = (function(connect) {

    // Connect's Store
    var ConnectStore = connect.session.Store;

    function MemcachedStore(options) {
        options = options || { };
        ConnectStore.call(this, options);
        this.namespace = (options.namespace ? 'user:session:' : options.namespace);

        options.addr = options.addr || options.hosts || ((options.host || "localhost") + ":" + (options.port || "11211"));

        this.client = options.client || new require('memcached')(options.addr, options);

        this.ttl = options.ttl || (24 * 60 * 60);

        return this;
    }

    MemcachedStore.prototype = ConnectStore.prototype;

    MemcachedStore.prototype.get = function(sid, fn) {
        sid = this.namespace + sid;

        this.client.get(sid, function(err, data){
            if (err) return fn(err);
            if (!data) return fn();

            fn(null, JSON.parse(data));
        });
    };

    MemcachedStore.prototype.set = function(sid, sess, fn){
        sid = this.namespace + sid;
        this.client.set(sid, JSON.stringify(sess), this.ttl, function(err) {
            if(err || !fn) return;
            fn(null, true);
        });
    };

    MemcachedStore.prototype.destroy = function(sid, fn){
        sid = this.namespace + sid;
        this.client.del(sid, fn);
    };

    return MemcachedStore;
});
