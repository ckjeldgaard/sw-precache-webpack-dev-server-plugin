'use strict';

const crypto = require('crypto');
const swPrecache = require('sw-precache');
const multimatch = require('multimatch');

function hash(data) {
	const md5 = crypto.createHash('md5');
	return md5.update(data + Date.now()).digest('hex');
}

function precache(assets, opts) {
	// reset glob list to prevent precache to use
	// unavailable compiled files on webpack
	let globs = opts.staticFileGlobs || [];
	opts.staticFileGlobs = [];

	return swPrecache.generate(opts).then(sw => {
		let cached = Object.keys(assets);

		if (globs.length > 0) {
			cached = cached.filter(a => multimatch(assets[a].existAt, globs).length > 0);
		}

		cached = cached.map(a => `['${a}', '${hash(a)}']`);

		const timestamp = `// Manipulated by SWPrecacheWebpackDevPlugin ${new Date()}\n`;
		const re = new RegExp('var precacheConfig = \\[.*\\];', 'gi');
		const precache = `${timestamp}var precacheConfig = [${cached.join(', ')}]\n`;
		return sw.replace(re, precache);
	});
}

class SWPrecacheWebpackDevPlugin {
	constructor(opts) {
		this.opts = Object.assign({
			logger: function () {},
			filename: 'sw.js'
		}, opts);
	}

	apply(compiler) {
		compiler.plugin('emit', (compilation, done) => {
			precache(compilation.assets, this.opts).then(sw => {
				compilation.assets[this.opts.filename] = {
					source: () => sw,
					size: () => sw.length
				};

				done();
			}, err => {
				throw new Error(`Precached failed: ${err.toString()}`)
			});
		});
	}
}

module.exports = SWPrecacheWebpackDevPlugin;