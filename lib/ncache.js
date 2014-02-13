module.exports = (function () {

	var cache = (function () {

		function Cache(args) {
			this.store = args.store;
			return this;
		}

		Cache.prototype.get = function (key, callback) {
			this.store.get(key, callback);
			return this;
		};

		Cache.prototype.put = function (key, val, expires, callback) {
			if (arguments.length == 2) {
				expires = false;
				callback = function () {};
			}
			else if (typeof expires == 'function') {
				callback = expires;
				expires = false;
			}
			this.store.set(key, val, expires, callback);
			return this;
		};

		Cache.prototype.free = function (key, callback) {
			this.store.free(key, callback);
			return this;
		};

		Cache.prototype.map = function (callback) {
			if (typeof callback == 'function') {
				this.store.data.map(callback);
			}
			return this;
		};

		Cache.prototype.collectExpired = function (callback) {
			this.store.collectExpired(callback);
			return this;
		};

		return Cache;
	})();

	var memoryStore = (function () {

		function MemoryStore(data) {
			this.data = data || {};
			this.expirationMap = {};
			this.lastID = "";
			this.expiration = 3600000 // 1hour
			return this;
		}

		MemoryStore.prototype.set = function (key, val, expires, callback) {
			this.data[key] = val;
			this.expirationMap[key] = Date.now() + (expires ? expires : this.expiration);
			this.lastID = key;
			if (callback) {
				callback(this.lastID, {}, arguments);
			}
			return this;
		};

		MemoryStore.prototype.get = function (key, callback) {
			if (typeof this.data[key] !== "undefined" && !(this.expirationMap[key] > 0 && this.expirationMap[key] < Date.now())) {
				callback(this.data[key], null);
			}
			else {
				callback([], ["ERROR: " + key + " is Expired or Not exists"]);
			}
			return this;
		};

		MemoryStore.prototype.free = function (key, callback) {
			delete this.data[key];
			if (callback) {
				callback(arguments);
			}
			return this;
		};

		MemoryStore.prototype.collectExpired = function (callback) {
			var now = Date.now();
			for (var key in this.data) {
				if (!(this.expirationMap[key] > 0 && this.expirationMap[key] < Date.now())) {
					delete this.data[key];
				}
			}
			if (callback) {
				callback(arguments);
			}
			return this;
		};

		return MemoryStore;
	})();

	var memCachedStore = (function () {

		function MemCachedStore(memcached) {
			this.memcached = memcached || {};
			this.expiration = 2592000 // in secs -> 30 days
			return this;
		}

		MemCachedStore.prototype.set = function (key, val, expires, callback) {
			this.lastID = key;
			this.memcached.set(key, val, (expires ? expires : this.expiration), callback.bind(this, this.lastID));
			return this;
		};

		MemCachedStore.prototype.get = function (key, callback) {
			this.memcached.get(key, function (err, data) {
				callback(data, err);
			});
			return this;
		};

		MemCachedStore.prototype.free = function (key, callback) {
			this.memcached.del(key, callback.bind(this, key));
			return this;
		};

		return MemCachedStore;
	})();

	var redisStore = (function () {

		function RedisStore(redis) {
			this.redis = redis || {};
			this.expiration = 2592000 // in secs -> 30 days
			return this;
		}

		RedisStore.prototype.set = function (key, val, expires, callback) {
			this.lastID = key;
			this.redis.set(key, val, callback.bind(this, this.lastID));
			return this;
		};

		RedisStore.prototype.get = function (key, callback) {
			this.redis.get(key, function (err, data) {
				callback(data, err);
			});
			return this;
		};

		RedisStore.prototype.free = function (key, callback) {
			this.redis.del(key, callback.bind(this, key));
			return this;
		};

		return RedisStore;
	})();

	var mysqlStore = (function () {

		function MySQLStore(conn) {
			this.conn = conn;
			this.lastID = 0;
			this.erros = [];
			this.expiration = 3600000 // 1hour
			this.table = "mNode_store";
			return this;
		}

		MySQLStore.prototype.insert = function (val, args, callback) {
			var __this = this;
			this.conn.query("INSERT INTO `" + this.table + "` SET ? ", val, function (err, res) {
				if (err) {
					__this.erros.push(err);
					__this.update(val, args, callback);
					return;
				}
				__this.lastID = res.insertId;
				if (callback) {
					callback(__this.lastID, err, arguments);
				}
			});
			return this;
		};

		MySQLStore.prototype.update = function (val, args, callback) {
			var __this = this;
			this.conn.query("UPDATE `" + this.table + "` SET ? WHERE " + args + " ", val, function (err, res) {
				if (err) {
					__this.erros.push(err);
					if (callback) {
						callback(0, err, arguments);
					}
					throw err;
				}
				__this.lastID = res.insertId;
				if (callback) {
					callback(__this.lastID, err, arguments);
				}
			});
			return this;
		};

		MySQLStore.prototype.set = function (key, val, expires, callback) {
			var __this = this;
			try {
				this.insert({
					key     : key,
					scope   : "global",
					value   : JSON.stringify(val),
					modified: Date.now(),
					expire  : Date.now() + (expires ? expires : __this.expiration),
					active  : 1
				}, " `key` = '" + key + "' ", callback);
			}
			catch (e) {
				this.update({
					key     : key,
					scope   : "global",
					value   : JSON.stringify(val),
					modified: Date.now(),
					expire  : Date.now() + (expires ? expires : __this.expiration),
					active  : 1
				}, " `key` = '" + key + "' ", callback);
			}
			return this;
		};

		MySQLStore.prototype.select = function (args, callback) {
			var locRes = [];
			var __this = this;
			this.conn.query("SELECT * FROM `" + this.table + "` " + (args ? " WHERE " + args : ""), function (err, rows, fields) {
				if (err) {
					__this.erros.push(err);
					callback([], err);
					return;
				}
				locRes = rows;
				callback(rows, null);
			});

			return this;
		};

		MySQLStore.prototype.get = function (key, callback) {
			var args = " `key` = '" + key + "' ";
			return this.select(args, callback);
		};

		MySQLStore.prototype.delete = function (args, callback) {
			var __this = this;
			this.conn.query('DELETE FROM `' + this.table + '` WHERE ' + args, function (err, res) {
				if (err) {
					__this.erros.push(err);
				}
				if (callback) {
					callback(0, err, arguments);
				}
			});
			return this;
		};

		MySQLStore.prototype.free = function (key, callback) {
			var args = " `key` = '" + key + "' ";
			return this.delete(args, callback);
		};

		MySQLStore.prototype.inactivate = function (key, callback) {
			var __this = this;
			this.conn.query('INSERT INTO `' + this.table + '` SET ? WHERE `key` = "' + key + "'", {active: 0}, function (err, res) {
				if (err) {
					__this.erros.push(err);
				}
				__this.lastID = res.insertId;
				if (callback) {
					callback(__this.lastID, err, arguments);
				}
			});
			return this;
		};

		MySQLStore.prototype.collectExpired = function (callback) {
			var args = "( `expire` < " + Date.now() + " AND `expire` != 0 ) OR active = 0 ";
			return this.delete(args, callback);
		};

		return MySQLStore;
	})();

	return {
		sqlCache : function (args) {
			args = args || {};
			return new cache({
				store: new mysqlStore(args.connection)
			});
		},
		mCache   : function (args) {
			args = args || {};
			return new cache({
				store: new memoryStore(args.data)
			});
		},
		memcached: function (args) {
			args = args || {};
			return new cache({
				store: new memCachedStore(args.connection)
			});
		},
		redis    : function (args) {
			args = args || {};
			return new cache({
				store: new redisStore(args.connection)
			});
		}
	};
})();