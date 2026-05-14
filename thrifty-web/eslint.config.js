import pluginVue from "eslint-plugin-vue";
import js from "@eslint/js";

export default [
  js.configs.recommended,
  ...pluginVue.configs["flat/recommended"],
  {
    rules: {
      "vue/no-v-model-argument": "off",
      "vue/multi-word-component-names": "off",
      "vue/require-default-prop": "off",
      "no-unused-vars": "warn",
    },
  },
];
