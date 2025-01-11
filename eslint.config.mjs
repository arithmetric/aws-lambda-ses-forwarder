import globals from "globals";
import pluginJs from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import stylisticJs from "@stylistic/eslint-plugin-js";

/** @type {import('eslint').Linter.Config[]} */
export default [
  pluginJs.configs.recommended,
  stylistic.configs.customize({
    quotes: "double",
    semi: true,
    commaDangle: "only-multiline",
  }),
  {
    files: ["**/*.js"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
      sourceType: "commonjs",
    },
    plugins: {
      "@stylistic/js": stylisticJs,
    },
    rules: {
      "@stylistic/brace-style": 0,
      "@stylistic/multiline-ternary": 0,
      "@stylistic/object-curly-spacing": 0,
      "@stylistic/operator-linebreak": 0,
      "@stylistic/quotes": 0,
      "@stylistic/space-before-function-paren": 0,
    },
  },
];
