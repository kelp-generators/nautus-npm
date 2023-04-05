const generator = async (prompts, validationRegExes, about, dir, cmd, mergeScript, removeDefault, chalk, fs) => {
    /*
        DON'T DELETE THIS COMMENT, YOU MIGHT NEED IT LATER

        This function will get run when creating boilerplate code.
        You can use the above defined methods to generate code
        Here's a brief explanation of each:

        prompts: contains various prompt functions to get input frome the use
            {
                async prompt(question, defaultValue = '', validationRegEx = null, canBeEmpty = false, validatorFunction = null) => string // NOTE: The validatorFunction can be async
                async confirm(question) => true|false
                async numeral(question, validatorFunction) => number
                async toggle(question, option1, option2) => option1|option2
                async select(question, [...choices]) => choice
                async multiSelect(question, [...choices], min = 0, max = Infinity) => [...choices]
            }
        validationRegExes: contains various RegExes that are useful when dealing with prompts. As of now:
            {
                identifier: Allows a-z, A-Z, -, _, @, ~ and .
                license: Allows valid SPDX licenses, UNKNOWN and SEE LICENSE IN <file>
                repository: Allows github repos, eg. username/repo
                email: Allows valid emails,
                confirmation: Allows yes, no, y and n
                username: Allows typically valid usernames
                url: Allows urls with optional protocol
                phone: Allows international phone numbers
            }
        about: contains whatever the user specified using nautus me. NOTE: All fields can be empty
            {
                realName,
                githubUsername,
                name,
                gender,
                email
            }
        dir: path to the directory where the project files are saved
        cmd: function that allows you to run commands jsut like in a nautus script
            async cmd(command: string) => [exitCode, stdout]
        mergeScript: function that allows you to merge code into a script. NOTE: Don't include the boilerplate for a script, jsut include what needs to be put in the function
            // scriptName shall not include @ or .js
            mergeScript(scriptName, code) => void
        removeDefault: function that removes the default error from a script
            // scriptName shall not include @ or .js
            removeDefault(scriptName) => void
        chalk: chalk module to help you style your console.log's. See https://www.npmjs.com/package/chalk for more
        fs: like the default fs module, but writeFile and writeFileSync are protected
            and ask user before overwriting existing files.
            NOTE: Usage of require('fs') is prohibited to protect the users data
    */

    const { prompt, confirm, numeral, toggle, select, multiSelect } = prompts
    const { identifier, repository } = validationRegExes

    // Do your prompts here
    const axios = require('axios')
    const path = require('path')

    const generatorName = await prompt('Name', '', identifier, false, async (input) => {
        // Check if npm module name is availble
        try {
            const res = await axios.get(`https://registry.npmjs.org/${encodeURIComponent(input)}`)
            if (res.data && res.data.error && res.data.error === 'Not found') {
                return true
            } else {
                console.log(chalk.yellow('A package with this name alread exists!'))
                return false
            }
        } catch {
            return true
        }
    })
    const description = await prompt('Description', '', null, true)
    if (!about.githubUsername) about.githubUsername = await prompt('Username')
    let repo = null

    const tsUsage = await confirm('Do you want to use TypeScript')
    let tsTarget
    if (tsUsage) {
        tsTarget = await prompt('Target', 'es5', /^(es|ES)(([0-9]|NEXT)*)$/)
    }

    let main = 'index.js'
    if (!tsUsage) {
        main = await toggle('Entry point', 'main.js', 'index.js')
    }

    const license = await prompt('License', 'MIT', validationRegExes.license)

    if (await confirm('Do you have a GitHub repo?')) {
        repo = await prompt('Repository', `${about.githubUsername}/${generatorName}`, repository)
    }

    // Do your generation here

    // Generate package.json
    const pkgJSON = {
        name: `${generatorName}`,
        version: '0.1.0',
        description,
        main: tsUsage ? `dist/${main}` : main,
        scripts: {
            test: "echo \"Error: no test specified\" && exit 1"
        },
        keywords: [],
        author: `${about.name || about.githubUsername} (https://github.com/${about.githubUsername})`,
        license,
        dependencies: {}
    }
    if (repo) {
        pkgJSON.repository = {
            type: 'git',
            url: `git+https://github.com/${repo}.git`
        }
        pkgJSON.bugs = {
            url: `https://github.com/${repo}/issues`
        }
        pkgJSON.homepage = `https://github.com/${repo}#readme`
    }
    if (tsUsage) pkgJSON.types = 'dist/index.d.ts'
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkgJSON))

    // Configuring TypeScript
    if (tsUsage) {
        await cmd('npm i typescript @types/node -D')
        fs.writeFileSync(path.join(dir, 'tsconfig.json'), JSON.stringify({
            compilerOptions: {
                target: tsTarget,
                module: 'commonjs',
                declaration: true,
                outDir: './dist',
                strict: true
            }
        }))

        fs.ensureDirSync(path.join(dir, 'lib'))
        fs.ensureFileSync(path.join(dir, 'lib', 'index.ts'))

        // @Build.js
        removeDefault('Build') // Removes the default error message
        mergeScript('Build', `exit(await spawn(modules.path.join(process.cwd(), 'node_modules/.bin/tsc'), []))`)

        // @Prep.js
        mergeScript('Prep', `await cmd(modules.path.join(process.cwd(), 'node_modules/.bin/tsc')).catch(error)`)

        // @Run.js
        removeDefault('Run') // Removes the default error message
        mergeScript('Run', `exit(await spawn('node', ["dist/${main}"]))`)

        // @Release.js
        removeDefault('Release')
        mergeScript('Release', fs.readFileSync(path.join(__dirname, 'templates', '@Releasets.js')))

        fs.appendFileSync(path.join(dir, '.npmignore'), 'lib/\n.dccache\nnautus\n')
    } else {
        // Create entry file
        fs.ensureFileSync(path.join(dir, main))

        // @Run.js
        removeDefault('Run') // Removes the default error message
        mergeScript('Run', `exit(await spawn('node', ["${main}"]))`)

        fs.appendFileSync(path.join(dir, '.npmignore'), '.dccache\nnautus\n')

        // @Release.js
        removeDefault('Release')
        mergeScript('Release', fs.readFileSync(path.join(__dirname, 'templates', '@Release.js')))
    }

    fs.ensureFileSync(path.join(dir, 'README.md'))

    // INFO
    console.log(chalk.green(`Successfully generated npm module. You can run it by using ${chalk.cyan('nautus run')}. To publish it to npm use ${chalk.cyan('nautus release major|minor|patch')}`))
}

const use = async (prompts, validationRegExes, about, dir, cmd, mergeScript, removeDefault, chalk, fs) => {
    /*
        DON'T DELETE THIS COMMENT, YOU MIGHT NEED IT LATER

        This function will get run when creating boilerplate code.
        You can use the above defined methods to generate code
        Here's a brief explanation of each:

        prompts: contains various prompt functions to get input frome the use
            {
                async prompt(question, defaultValue = '', validationRegEx = null, canBeEmpty = false, validatorFunction = null) => string // NOTE: The validatorFunction can be async
                async confirm(question) => true|false
                async numeral(question, validatorFunction) => number
                async toggle(question, option1, option2) => option1|option2
                async select(question, [...choices]) => choice
                async multiSelect(question, [...choices], min = 0, max = Infinity) => [...choices]
            }
        validationRegExes: contains various RegExes that are useful when dealing with prompts. As of now:
            {
                identifier: Allows a-z, A-Z, -, _, @, ~ and .
                license: Allows valid SPDX licenses, UNKNOWN and SEE LICENSE IN <file>
                repository: Allows github repos, eg. username/repo
                email: Allows valid emails,
                confirmation: Allows yes, no, y and n
                username: Allows typically valid usernames
                url: Allows urls with optional protocol
                phone: Allows international phone numbers
            }
        about: contains whatever the user specified using nautus me. NOTE: All fields can be empty
            {
                realName,
                githubUsername,
                name,
                gender,
                email
            }
        dir: path to the directory where the project files are saved
        cmd: function that allows you to run commands jsut like in a nautus script
            async cmd(command: string) => [exitCode, stdout]
        mergeScript: function that allows you to merge code into a script. NOTE: Don't include the boilerplate for a script, jsut include what needs to be put in the function
            // scriptName shall not include @ or .js
            mergeScript(scriptName, code) => void
        removeDefault: function that removes the default error from a script
            // scriptName shall not include @ or .js
            removeDefault(scriptName) => void
        chalk: chalk module to help you style your console.log's. See https://www.npmjs.com/package/chalk for more
        fs: like the default fs module, but writeFile and writeFileSync are protected
            and ask user before overwriting existing files.
            NOTE: Usage of require('fs') is prohibited to protect the users data
    */

    const { prompt, confirm, numeral, toggle, select, multiSelect } = prompts
    const { identifier, repository } = validationRegExes

    // Do your prompts here
    const axios = require('axios')
    const path = require('path')

    const generatorName = await prompt('Module name', '', identifier, false, async (input) => {
        // Check if npm module name is availble
        try {
            const res = await axios.get(`https://registry.npmjs.org/${encodeURIComponent(input)}`)
            if (res.data && res.data.error && res.data.error === 'Not found') {
                return true
            } else {
                console.log(chalk.yellow('A package with this name alread exists!'))
                return false
            }
        } catch {
            return true
        }
    })
    const description = await prompt('Description', '', null, true)
    if (!about.githubUsername) about.githubUsername = await prompt('Username')
    let repo = null

    const tsUsage = await confirm('Do you want to use TypeScript')
    let tsTarget
    if (tsUsage) {
        tsTarget = await prompt('Target', 'es5', /^(es|ES)(([0-9]|NEXT)*)$/)
    }

    let main = await prompt('Path to entry point', 'index.js')

    const license = await prompt('License', 'MIT', validationRegExes.license)

    if (await confirm('Do you have a GitHub repo?')) {
        repo = await prompt('Repository', `${about.githubUsername}/${generatorName}`, repository)
    }

    // Do your generation here

    // Generate package.json
    const pkgJSON = {
        name: `${generatorName}`,
        version: '0.1.0',
        description,
        main: tsUsage ? `dist/${main}` : main,
        scripts: {
            test: "echo \"Error: no test specified\" && exit 1"
        },
        keywords: [],
        author: `${about.name || about.githubUsername} (https://github.com/${about.githubUsername})`,
        license,
        dependencies: {}
    }
    if (repo) {
        pkgJSON.repository = {
            type: 'git',
            url: `git+https://github.com/${repo}.git`
        }
        pkgJSON.bugs = {
            url: `https://github.com/${repo}/issues`
        }
        pkgJSON.homepage = `https://github.com/${repo}#readme`
    }
    if (tsUsage) pkgJSON.types = 'dist/index.d.ts'
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkgJSON))

    // Configuring TypeScript
    if (tsUsage) {
        await cmd('npm i typescript @types/node -D')
        fs.writeFileSync(path.join(dir, 'tsconfig.json'), JSON.stringify({
            compilerOptions: {
                target: tsTarget,
                module: 'commonjs',
                declaration: true,
                outDir: './dist',
                strict: true
            }
        }))

        fs.ensureFileSync(path.join(dir, main))

        // @Build.js
        removeDefault('Build') // Removes the default error message
        mergeScript('Build', `exit(await spawn(modules.path.join(process.cwd(), 'node_modules/.bin/tsc'), []))`)

        // @Prep.js
        mergeScript('Prep', `await cmd(modules.path.join(process.cwd(), 'node_modules/.bin/tsc')).catch(error)`)

        // @Run.js
        removeDefault('Run') // Removes the default error message
        mergeScript('Run', `exit(await spawn('node', ["dist/${main}"]))`)

        // @Release.js
        removeDefault('Release')
        mergeScript('Release', fs.readFileSync(path.join(__dirname, 'templates', '@Releasets.js')))

        fs.appendFileSync(path.join(dir, '.npmignore'), 'lib/\n.dccache\nnautus\n')
    } else {
        // Create entry file
        fs.ensureFileSync(path.join(dir, main))

        // @Run.js
        removeDefault('Run') // Removes the default error message
        mergeScript('Run', `exit(await spawn('node', ["${main}"]))`)

        fs.appendFileSync(path.join(dir, '.npmignore'), '.dccache\nnautus\n')

        // @Release.js
        removeDefault('Release')
        mergeScript('Release', fs.readFileSync(path.join(__dirname, 'templates', '@Release.js')))
    }

    fs.ensureFileSync(path.join(dir, 'README.md'))

    // INFO
    console.log(chalk.green(`Successfully generated npm module. You can run it by using ${chalk.cyan('nautus run')}. To publish it to npm use ${chalk.cyan('nautus release major|minor|patch')}`))
}

module.exports = {
    generator: generator, // This will get run if you use nautus kelp (aka want to create boilerplate in afresh project)
    use: use, // This will get run if you use nautus use (aka want additional boilerplate or support for a framework / runtime). Make sure that this won't replace important stuff
    commands: () => {
        /*
            If you just want to create boilerplate code, this function is irrelevant for you.
            If you want to create commands anyways, use "nautus use commands"
            in this project to add command support.
        */
    },
    gitIgnore: `# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
lerna-debug.log*
.pnpm-debug.log*

# Typescript
dist/

# Diagnostic reports (https://nodejs.org/api/report.html)
report.[0-9]*.[0-9]*.[0-9]*.[0-9]*.json

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Directory for instrumented libs generated by jscoverage/JSCover
lib-cov

# Coverage directory used by tools like istanbul
coverage
*.lcov

# nyc test coverage
.nyc_output

# Grunt intermediate storage (https://gruntjs.com/creating-plugins#storing-task-files)
.grunt

# Bower dependency directory (https://bower.io/)
bower_components

# node-waf configuration
.lock-wscript

# Compiled binary addons (https://nodejs.org/api/addons.html)
build/Release

# Dependency directories
node_modules/
jspm_packages/

# Snowpack dependency directory (https://snowpack.dev/)
web_modules/

# TypeScript cache
*.tsbuildinfo

# Optional npm cache directory
.npm

# Optional eslint cache
.eslintcache

# Optional stylelint cache
.stylelintcache

# Microbundle cache
.rpt2_cache/
.rts2_cache_cjs/
.rts2_cache_es/
.rts2_cache_umd/

# Optional REPL history
.node_repl_history

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity

# dotenv environment variable files
.env
.env.development.local
.env.test.local
.env.production.local
.env.local

# parcel-bundler cache (https://parceljs.org/)
.cache
.parcel-cache

# Next.js build output
.next
out

# Nuxt.js build / generate output
.nuxt
dist

# Gatsby files
.cache/
# Comment in the public line in if your project uses Gatsby and not Next.js
# https://nextjs.org/blog/next-9-1#public-directory-support
# public

# vuepress build output
.vuepress/dist

# vuepress v2.x temp and cache directory
.temp
.cache

# Serverless directories
.serverless/

# FuseBox cache
.fusebox/

# DynamoDB Local files
.dynamodb/

# TernJS port file
.tern-port

# Stores VSCode versions used for testing VSCode extensions
.vscode-test

# yarn v2
.yarn/cache
.yarn/unplugged
.yarn/build-state.yml
.yarn/install-state.gz
.pnp.*

# Snyk
.dccache
`
}