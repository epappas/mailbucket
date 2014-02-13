var conf = function () {
	var conf = {};
	return (function (name, args) {

		var config;
		try {
			config = require("../conf/config.json");
		}
		catch(e) {
			config = {defaultSet: "dev"};
		}

		var env = process.env.ENVIROMENT || config["defaultSet"];

		process.argv.forEach(function (val) {
			if (val.split("mode").length > 1) {
				env = val.split(":")[1];
			}
		});
		conf = include(conf, env, "../conf/config." + name + ".json");
		conf = include(conf, env, "../conf/ioc.conf.json");
		conf = include(conf, env, "../conf/ioc.conf." + name + ".json");
		conf = include(conf, env, "../conf/api.conf.json");
		conf = include(conf, env, "../conf/api.conf." + name + ".json");
		conf = include(conf, env, "../conf/usr.conf.json");
		conf = include(conf, env, "../conf/usr.conf." + name + ".json");

		args = args || { };
		for (var prop in args) {
			conf[prop] = args[prop];
		}

		return conf;
	});
};

module.exports = conf();

function include(conf, env, filename) {
	var config = tryRequire(filename);
	config = config && config[env] || config || { };
	for (var prop in config) {
		if(Array.isArray(config[prop])) {
			conf[prop] = [].concat(conf[prop] || [ ], config[prop]);
			continue;
		}
		conf[prop] = config[prop];
	}
	return conf;
}

function tryRequire(name) {
	try {
		return require(name);
	}
	catch(e) {
		return { };
	}
}
