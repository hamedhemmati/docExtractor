const path = require("path");

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Allow imports from outside src/ directory
      webpackConfig.resolve.alias = {
        ...webpackConfig.resolve.alias,
        "@": path.resolve(__dirname, "src"),
        "@root": path.resolve(__dirname)
      };

      // Add the project root to the module resolution
      webpackConfig.resolve.modules = [
        ...webpackConfig.resolve.modules,
        path.resolve(__dirname)
      ];

      // Override the ModuleScopePlugin to allow imports from outside src/
      const ModuleScopePlugin = require("react-dev-utils/ModuleScopePlugin");
      webpackConfig.resolve.plugins = webpackConfig.resolve.plugins.filter(
        (plugin) => !(plugin instanceof ModuleScopePlugin)
      );

      return webpackConfig;
    }
  }
};
