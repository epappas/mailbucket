var events = require('events');
var conf = require("./conf.js");
var uuid = require('./uuid');
global.systemInstance = null;

var serviceLocator = {};
// Creating a global singleton
var system = (function (conf) {

	function System() {
		this.serviceLocator = serviceLocator(this);
	}

	// inherit
	(function (father) {
		// I am your Father!
		this.prototype = father;
		return this;
	}).call(System, new events.EventEmitter());

	System.prototype.init = function(name, args) {
		this.conf = conf(name, args);
		return this;
	};

	System.prototype.set = function(key, val) {
		this.conf[key] = val;
		return this;
	};

	System.prototype.get = function(key) {
		return this.conf[key];
	};

	System.prototype.getUuid = function (pattern) {
		return uuid.get(pattern || 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
	};

	System.prototype.initRoutes = function(app) {
		var self = this;
		this.routes = this.conf.routes.map(function(route) {
			var module = require('../' + route);
			module.call(process, self, app);
			return module;
		});
	};

	return System;
})(conf);

serviceLocator = (function(system) {

	function ServiceLocator() {
		this.store = {
			routes: [],
			hooks: {}
		};

		return this;
	}

	ServiceLocator.prototype.addService = function(route, service, callable) {
		if(route.indexOf("/route") === 0) {

		}
	};

	return ServiceLocator;
});

module.exports = __getInstance();

function __getInstance() {
	if (global.systemInstance === null) {
		return (global.systemInstance = new system());
	}
	return global.systemInstance;
}
