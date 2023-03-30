// This will automoatically publish your code to npm
await spawn('./node_modules/.bin/tsc')
const { path, fs } = modules
const file = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json')))
const { version } = file
const versionArray = version.split('.')
const { releasetype } = global
if (releasetype === 'major') {
    versionArray[0] = (parseInt(versionArray[0]) + 1).toString()
    versionArray[1] = '0'
    versionArray[2] = '0'
} else if (releasetype === 'minor') {
    versionArray[1] = (parseInt(versionArray[1]) + 1).toString()
    versionArray[2] = '0'
} else {
    versionArray[2] = (parseInt(versionArray[2]) + 1).toString()
}
const newVersion = versionArray.join('.')
file.version = newVersion
fs.writeFileSync(path.join(process.cwd(), 'package.json'), JSON.stringify(file))
await spawn('npm', ['publish'])