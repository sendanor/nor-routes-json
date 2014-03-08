/** Routes */

"use strict";

var copy = require('nor-data').copy;
var is = require('nor-is');
var debug = require('nor-debug');
var fs = require('nor-fs');

/** Routes constructor */
function Routes(opts, items) {
	var self = this;
	opts = opts || {};
	items = items || [];
	debug.assert(self).is('object');
	debug.assert(opts).is('object');
	debug.assert(items).is('array');

	opts = copy(opts);
	self.file = opts.file;
	self.items = copy(items);
	self.changed = opts.changed || false;

	debug.assert(self.file).is('string');
	debug.assert(self.items).is('array');
}

/** Load routes from filesystem */
Routes.load = function(path) {
	var items;
	debug.assert(path).is('string');
	var data = fs.sync.readFile(path, {'encoding':'utf8'});
	debug.assert(data).is('string');
	items = JSON.parse(data);
	debug.assert(items).is('array');
	return new Routes({'file': path, 'changed':false}, items);
};

/** Update the routes from Express App */
Routes.prototype.update = function(app) {
	var self = this;

	debug.assert(self.items).is('array');
	debug.assert(app).is('function');

	var paths = {};
	self.items.forEach(function(route) {
		var path = route.path;
		if(!is.object(paths[path])) {
			paths[path] = {};
		}
		paths[path][route.method] = route;
	});

	function _exists(path, method) {
		return is.object(paths[path]) && is.object(paths[path][method]) ? true : false;
	}

	debug.assert(app.routes).is('object');

	function capitalize(s) {
		return s[0].toUpperCase() + s.slice(1);
	}

	Object.keys(app.routes).forEach(function(method) {
		debug.assert(app.routes[method]).is('array');
		app.routes[method].forEach(function(route) {
			var obj;
			if(!_exists(route.path, method)) {
				obj = {
					'summary': capitalize('' + method + ' ' + route.path),
					'path': route.path,
					'method': method,
					'keys': route.keys,
					'flags': {
						'admin': true
					}
				};
				self.changed = true;
				self.items.push(obj);
				if(!paths[route.path]) {
					paths[route.path] = {};
				}
				paths[route.path][method] = obj;
				debug.log("New route added to routes.json:", obj);
			}
		});
	});

	return self;
};

/** Find a route */
Routes.prototype.find = function(opts) {
	debug.assert(opts).is('object');
	var self = this;
	debug.assert(self.items).is('array');
	return self.items.filter(function(route) {
		debug.assert(route).is('object');
		return Object.keys(opts).map(function(key) {
			return route[key] === opts[key] ? true : false;
		}).every(is.true);
	});
};

/** Save the routes to file */
Routes.prototype.save = function() {
	var self = this;
	debug.assert(self.file).is('string');
	debug.assert(self.items).is('array');
	if(self.changed) {
		self.items.sort(function(a, b) {
			function cmp(a, b) {
				if(a === b) { return 0; }
				return a < b ? -1 : 1;
			}
			if(a.path === b.path) { return cmp(a.method, b.method); }
			return cmp(a.path, b.path);
		});
		var data = JSON.stringify(self.items, null, 2) + "\n";
		debug.assert(data).is('string');
		fs.sync.writeFile(self.file, data, {'encoding':'utf8'});
	}
	return self;
};

// Exports
module.exports = Routes;

/* EOF */
