/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/lib/syra/__tests__"],
  testMatch: ["**/lib/syra/__tests__/**/*.test.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        // The repo's tsconfig targets ES6 + bundler resolution which ts-jest
        // handles fine for these pure-TS modules (no JSX in lib/syra).
        tsconfig: {
          esModuleInterop: true,
          module: "commonjs",
          moduleResolution: "node",
          target: "ES2019",
          strict: true,
          skipLibCheck: true,
        },
      },
    ],
  },
}
