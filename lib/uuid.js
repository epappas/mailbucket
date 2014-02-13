module.exports = UUID;

module.exports.get = function(pattern) {
    var hex = new (UUID(16))(pattern);
    return hex.get();
};

function UUID(base) {

    base = base || 0x10; // 16
    var bm1 = base-1;
    var bls = base>>>2;
    var bd2 = base/2;
    var bd2m1 = bd2-1;

    function __UUID(pattern) {
        this.pattern = pattern || 'a:w:yyy';
        return this;
    }

    /**
     * O(x+n) or O(x+2n)
     * x == 3, n == O(Math.random)
     * @returns {*|void}
     */
    __UUID.prototype.get = function() {
        return this.pattern.replace(/[xy]/g, function(c, i) {
            var r = (bd2<<(i&bd2m1))*Math.random(), rb = r*base|0, v = (c == 'x' ? (rb == bls? (Math.random()%rb)*base|0 : (rb&bm1)) : (rb&0x9));
            return v.toString(16);
        });
    };

    return __UUID;
}
