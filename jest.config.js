module.exports = {
    preset: 'ts-jest',
    roots: ['<rootDir>/src'],
    testEnvironment: 'node',
    testRegex: '/__tests__/.*\\.spec\\.ts$',
    'coverageDirectory': "./coverage/",
    "collectCoverage": true,
    coverageReporters: [
        "json-summary",
        "text",
        "lcov"
    ]
};
