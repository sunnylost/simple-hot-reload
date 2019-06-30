module.exports = {
    root: true,
    env: {
        browser: true,
        node: true
    },
    parser: 'babel-eslint',
    extends: ['plugin:prettier/recommended'],
    plugins: ['prettier'],
    rules: {
        semi: ['error', 'never'],
        'prettier/prettier': 'error'
    }
}
