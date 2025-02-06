/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.NODE_ENV === 'production' ? 'export' : undefined,
  distDir: process.env.NODE_ENV === 'production' ? 'out' : '.next',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  // Ensure React is properly loaded in development
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }

    // Add rule for handling private class fields
    config.module.rules.push({
      test: /\.m?js$/,
      include: [
        /node_modules\/@firebase/,
        /node_modules\/firebase/,
        /node_modules\/undici/,
      ],
      use: {
        loader: 'babel-loader',
        options: {
          presets: ['@babel/preset-env'],
          plugins: [
            '@babel/plugin-transform-private-methods',
            '@babel/plugin-transform-class-properties'
          ]
        }
      }
    });

    return config;
  },
  // Ensure we can use Ionic components and Firebase
  transpilePackages: [
    '@ionic/react', 
    '@ionic/core', 
    '@stencil/core', 
    'ionicons',
    'firebase',
    '@firebase/auth',
    '@firebase/app',
    '@firebase/firestore',
    '@firebase/storage',
    '@firebase/analytics',
    'undici'
  ]
};

module.exports = nextConfig;