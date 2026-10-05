import next from "eslint-config-next";

// Flat config directly from the package. Routing it through FlatCompat, as the
// older examples do, feeds eslint a config object with a circular reference and
// it fails while trying to report the error rather than while linting.
const config = [
  ...next,
  {
    ignores: [".next/**", "node_modules/**", "contracts/**", "tests/**",
              "scripts/**", "fixtures/**"],
  },
];

export default config;
