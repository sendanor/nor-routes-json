/** Routes */

"use strict";

var copy = require('nor-data').copy;
var is = require('nor-is');
var debug = require('nor-debug');
var fs = require('nor-fs');

/** Load targets */
function load_targets(self) {
	debug.assert(self).is('object');
	debug.assert(self.items).is('array');
	debug.assert(self.targets).is('object');

	self.targets = {};
	self.items.forEach(function(item) {
		if( !(item && (item.path !== undefined) && (item.method !== undefined)) ) {
			return;
		}
		if(self.targets[item.path] === undefined) {
			self.targets[item.path] = {};
		}
		if(self.targets[item.path][item.method] !== undefined) {
			debug.info("Detected duplicate: ", item.method, ' ', item.path, ' (ignored it)');
			item.duplicate = true;
			return;
		}
		self.targets[item.path][item.method] = item;
	});
}

/** Routes constructor */ function Routes(opts, items) {
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

	debug.assert(self.items).is('array');

	// Make an object (hash map) as an index for searching targets faster (path + method)
	self.targets = {};
	load_targets(self);

	debug.assert(self.file).is('string');
	debug.assert(self.targets).is('object');
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

/** Returns true if target exists */
Routes.prototype.targetExists = function target_exists(path, method) {
	var self = this;
	debug.assert(path).is('string');
	debug.assert(method).is('string');
	return !!( is.object(self.targets[path]) && is.object(self.targets[path][method]) );
}

/** Update the routes from Express App */
Routes.prototype.update = function(app) {
	var self = this;

	debug.assert(self.items).is('array');
	debug.assert(self.targets).is('object');
	debug.assert(app).is('function');

	debug.assert(app.routes).is('object');

	function capitalize(s) {
		debug.assert(s).is('string');
		return s[0].toUpperCase() + s.slice(1);
	}

	Object.keys(app.routes).forEach(function(method) {
		debug.assert(app.routes[method]).is('array');
		app.routes[method].forEach(function(route) {

			debug.assert(route).is('object');
			debug.assert(route.path).is('string');
			debug.assert(route.method).is('string');

			if(self.targetExists(route.path, route.method)) {
				return;
			}

			var obj = {
				'summary': capitalize('' + route.method + ' ' + route.path),
				'path': route.path,
				'method': route.method,
				'keys': route.keys,
				'flags': {
					'admin': true
				},
				'created': new Date().getTime()
			};

			self.changed = true;
			self.items.push(obj);

			if(!self.targets[route.path]) {
				self.targets[route.path] = {};
			}
			self.targets[route.path][route.method] = obj;
			debug.info("New route added to routes.json: ", route.method, ' ', route.path);
		});
	});

	return self;
};

/** Find a route by mixed options. Please note that this is much slower than specialized `_findTarget(path, method)`.
 * @returns {array} All matching routes in an array
 */
Routes.prototype.findMixed = function(opts) {
	var self = this;
	debug.assert(opts).is('object');
	debug.assert(self.items).is('array');
	var opts_keys = Object.keys(opts);
	return self.items.filter(function(route) {
		debug.assert(route).is('object');
		return opts_keys.map(function(key) {
			return route[key] === opts[key] ? true : false;
		}).every(is.true);
	});
};

/** Find a route by path and method. 
 * @returns {array} The routes which were found. Current implementation only returns one target because the cache contains only the first.
 */
Routes.prototype.findTarget = function(path, method) {
	var self = this;
	debug.assert(path).is('string');
	debug.assert(method).is('string');
	debug.assert(self.targets).is('object');
	
	var target = self.targets[path];
	if(target === undefined) {
		return [];
	}

	var route = target[method];
	if(route === undefined) {
		return [];
	}
	return [route];
};

/** Find routes by options 
 * @returns {array} All matching routes in an array
 */
Routes.prototype.find = function(opts) {
	debug.assert(opts).is('object');
	var self = this;
	var opts_keys = Object.keys(opts);
	if( (opts_keys.length === 2) && is.defined(opts.path) && is.defined(opts.method) ) {
		return self.findTarget(opts.path, opts.method);
	} else {
		return self.findMixed(opts);
	}
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
