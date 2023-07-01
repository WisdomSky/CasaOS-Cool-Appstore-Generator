export enum LogLevel {
    Info = 1,
    Error = 2,

    Silent = 0
}


export default class Log {
    static __level: LogLevel = LogLevel.Error;

    static setLogLevel(level: LogLevel): Log {
        Log.__level = level;
        return Log;
    }

    static info(...message): Log {
        if (Log.__level > 0 && Log.__level < 2) {
            console.log(...message)
        }
        return Log;
    }

    static error(...message): Log {
        if (Log.__level > 0) {
            console.error(...message)
        }
        return Log;
    }

}