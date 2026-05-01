const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = (env, argv) => {
  const isDev = argv.mode === 'development';

  return {
    entry: './renderer/index.js',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'bundle.js',
      clean: true
    },
    target: 'electron-renderer',
    module: {
      rules: [
        {
          test: /\.jsx?$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: [
                ['@babel/preset-env', { targets: { electron: '29' } }],
                ['@babel/preset-react', { runtime: 'automatic' }]
              ]
            }
          }
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader']
        },
        {
          test: /\.(ttf|woff|woff2|eot|otf)$/,
          type: 'asset/resource',
          generator: {
            filename: 'fonts/[name][ext]'
          }
        },
        {
          test: /\.(png|jpg|gif|svg|ico)$/,
          type: 'asset/resource',
          generator: {
            filename: 'images/[name][ext]'
          }
        }
      ]
    },
    resolve: {
      extensions: ['.js', '.jsx']
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './renderer/index.html',
        filename: 'index.html'
      }),
      // jspdf optional peer deps — not needed in Electron renderer
      new webpack.IgnorePlugin({ resourceRegExp: /^html2canvas$/ }),
      new webpack.IgnorePlugin({ resourceRegExp: /^dompurify$/ }),
      new webpack.IgnorePlugin({ resourceRegExp: /^canvg$/ }),
      // pdfjs-dist optional dep — browser has native Canvas
      new webpack.IgnorePlugin({ resourceRegExp: /^canvas$/, contextRegExp: /node_modules/ })
    ],
    devServer: isDev ? {
      static: path.join(__dirname, 'dist'),
      port: 9000,
      hot: true
    } : undefined,
    devtool: isDev ? 'eval-source-map' : false
  };
};
