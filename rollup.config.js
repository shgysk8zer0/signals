import terser from '@rollup/plugin-terser';

export default [{
	input: 'signals.js',
	output: [{
		file: 'signals.cjs',
		format: 'cjs',
	}, {
		file: 'signals.min.js',
		format: 'module',
		plugins: [terser()],
		sourcemap: true,
	}],
}];
