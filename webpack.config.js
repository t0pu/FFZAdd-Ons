/* global module __dirname */

const path = require('path');
const glob = require('glob');
const fs = require('fs');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const { WebpackManifestPlugin } = require('webpack-manifest-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const {
	DefinePlugin
} = require('webpack');

const StringReplacePlugin = require('string-replace-webpack-plugin');
const VueLoaderPlugin = require('vue-loader/lib/plugin');

const getFolderName = file => path.basename(path.dirname(file));

const FOR_EXTENSION = !! process.env.FFZ_EXTENSION;

const FILE_PATH = FOR_EXTENSION
	? process.env.FFZ_EXTENSION
	: '//cdn.frankerfacez.com/static/addons/';

const config = {
	mode: 'production',
	devtool: 'source-map',

	resolve: {
		extensions: ['.js', '.jsx']
	},

	entry: glob.sync('./src/**/index.{js,jsx}').reduce((entries, entry) => Object.assign(entries, {
		[`${getFolderName(entry)}/script`]: entry
	}), {}),
	externals: [
		function(context, request, callback) {
			if ( request === 'vue' )
				return callback(null, 'root ffzVue');
			callback();
		}
	],
	output: {
		publicPath: FILE_PATH, // '//cdn.frankerfacez.com/static/addons/',
		path: path.resolve(__dirname, 'dist/addons'),
		filename: FOR_EXTENSION
			? '[name].js'
			: '[name].[hash].js',
		jsonpFunction: 'ffzAddonsWebpackJsonp'
	},

	optimization: {
		minimizer: [
			new TerserPlugin({
				sourceMap: true,
				terserOptions: {
					keep_classnames: true,
					keep_fnames: true
				}
			})
		]
	},

	plugins: [
		new VueLoaderPlugin(),
		new CleanWebpackPlugin(),
		new DefinePlugin({
			Addon: 'FrankerFaceZ.utilities.addon.Addon',
		}),
		new WebpackManifestPlugin({
			serialize: thing => JSON.stringify(thing),
			filter: data => ! data.name.endsWith('.map'),
			basePath: 'addons/',
			publicPath: 'addons/'
		}),
		new CopyPlugin([
			{
				from: 'src/**/logo.png',
				to: '[1]/logo.png',
				toType: 'template',
				test: /src(?:\\|\/)([^\\\/]+)(?:\\|\/)logo\.png$/
			}
		]),
		new CopyPlugin([
			{
				from: 'src/**/logo.jpg',
				to: '[1]/logo.jpg',
				toType: 'template',
				test: /src(?:\\|\/)([^\\\/]+)(?:\\|\/)logo\.jpg$/
			}
		]),
		new WebpackManifestPlugin({
			fileName: path.resolve(__dirname, 'dist', 'addons.json'),
			serialize: thing => JSON.stringify(thing, null, '\t'),
			generate: () => {
				const addons = [];
				for (const manifest of glob.sync('./src/**/manifest.json')) {
					const json = JSON.parse(fs.readFileSync(manifest));
					if ( ! json.enabled )
						continue;

					delete json.enabled;
					json.id = getFolderName(manifest);

					if ( ! json.icon && fs.existsSync(path.join(path.dirname(manifest), 'logo.png')) )
						json.icon = `${FILE_PATH}${json.id}/logo.png`;

					if ( ! json.icon && fs.existsSync(path.join(path.dirname(manifest), 'logo.jpg')) )
						json.icon = `${FILE_PATH}${json.id}/logo.jpg`;

					addons.push(json);
				}
				return addons;
			}
		}),
		new StringReplacePlugin()
	],

	module: {
		rules: [{
			test: /index\.jsx?$/,
			exclude: /node_modules/,
			loader: StringReplacePlugin.replace({
				replacements: [{
					pattern: /\.register\(\);/ig,
					replacement() {
						const folder = path.dirname(this._module.rawRequest).substring(6);
						const modString = `.register('${folder}');`;
						return modString;
					}
				}]
			})
		},
		{
			test: /\.jsx?$/,
			exclude: /node_modules/,
			loader: StringReplacePlugin.replace({
				replacements: [{
					pattern: /import\('\.\/(.*)\.(.*)'\)/ig,
					replacement(match, fileName, extension) {
						const folder = path.dirname(this._module.rawRequest).substring(6);
						const modString = `import(/* webpackChunkName: "${folder}/${extension}" */ './${fileName}.${extension}')`;
						return modString;
					}
				}]
			})
		},
		{
			test: /\.jsx?$/,
			exclude: /node_modules/,
			loader: 'babel-loader',
			options: {
				cacheDirectory: true,
				plugins: [
					['@babel/plugin-transform-react-jsx', {
						pragma: 'createElement'
					}]
				]
			}
		},
		{
			test: /\.(graphql|gql)$/,
			exclude: /node_modules/,
			loader: 'graphql-tag/loader'
		},
		{
			test: /\.vue$/,
			loader: 'vue-loader'
		},
		{
			test: /\.s?css$/,
			use: [{
				loader: 'file-loader',
				options: {
					name: FOR_EXTENSION
						? '[folder]/[name].css'
						: '[folder]/[name].[hash].css'
				}
			}, {
				loader: 'extract-loader'
			}, {
				loader: 'css-loader',
				options: {
					sourceMap: true
				}
			}, {
				loader: 'sass-loader',
				options: {
					sourceMap: true
				}
			}]
		}]
	},
};

module.exports = config;
