class Logger {
    static setOutputStream(stream) {
        this.outputStream = stream;
    }
    static debug(message, ...args) {
        this.outputStream.write(`[DEBUG] ${message} ${args.join(' ')}
`);
    }
    static info(message, ...args) {

        this.outputStream.write(`[INFO] ${message} ${args.join(' ')}\n`);
    }
    static warn(message, ...args) {
        this.outputStream.write(`[WARN] ${message} ${args.join(' ')}\n`);
    }
    static error(message, ...args) {
        this.outputStream.write(`[ERROR] ${message} ${args.join(' ')}\n`);
    }
    static close() {
        // Only close if it's not stdout/stderr
        if (this.outputStream !== process.stdout && this.outputStream !== process.stderr) {
            this.outputStream.end();
        }
    }
}
Logger.outputStream = process.stdout;
export { Logger };
