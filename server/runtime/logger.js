'use strict';

const { createLogger, format, transports } = require('winston');
const fs = require('node:fs');
const path = require('node:path');

var initialized = false;
var filelogger;
var logDir = '';

const env = process.env.NODE_ENV || 'development';
const logFileName = 'fuxa.log';
const errorFileName = 'fuxa-err.log';

var log = module.exports = {

    init: function (logdir) {
        if (logdir) {
            logDir = logdir;
        }
        filelogger = createLogger({
            level: env === 'production' ? 'info' : 'debug',
            format: format.combine(
                // format.label({ label: path.basename(caller) }),
                format.timestamp(),
                format.printf(info => `${info.timestamp} [${info.level}] ${info.message}`)
            ),
            transports: [
                // new transports.Console({
                //     level: 'info',
                //     format: format.combine(
                //       format.colorize(),
                //       format.timestamp({format: 'YYYY-MM-DD HH:mm:ss.fff'}),
                //       format.printf(info => `${info.timestamp} [${info.level}] ${info.message}`)
                //     )
                // }),                
                new (transports.File)({
                    level: 'info',
                    filename: `${logDir}/${logFileName}`,
                    maxsize: 1_048_576, // 1MB
                    maxFiles: 5,
                    json: false
                }),
                new (transports.File)({
                    level: 'error',
                    filename: `${logDir}/${errorFileName}`,
                    maxsize: 1_048_576,//5242880, // 1MB
                    maxFiles: 5,
                    json: false
                })
            ]
        });
        initialized = true;
    },

    debug: function (str, flag) {
        //	debug color: Cyan
        console.log("\u001B[36m" + new Date().toISOString() + ' [DBG]  ' + "\t" + processInput(str) + "\u001B[39m");
        if (initialized && (undefined == flag || true === flag)) {
            filelogger.debug(str);
        }
    },
    info: function (str, flag) {
        //	debug color: Default (White / Black)
        if (initialized && (undefined == flag || false === flag)) {
            console.log(new Date().toISOString() + ' [INF] ' + "\t" + processInput(str));
        }
        if (initialized && (undefined == flag || true === flag)) {
            filelogger.info(str);
        }
    },
    trace: function (str, flag) {
        //	trace color: Grey
        console.error("\u001B[90m" + new Date().toISOString() + ' [TRA] ' + "\t" + processInput(str) + "\u001B[0m");
        if (initialized && (undefined == flag || true === flag)) {
            filelogger.trace(str);
        }
    },
    warn: function (str, flag) {
        //	warn color: Yellow
        console.log("\u001B[33m" + new Date().toISOString() + ' [WAR] ' + "\t" + processInput(str) + "\u001B[39m");
        if (initialized && (undefined == flag || true === flag)) {
            filelogger.warn(str);
        }
    },
    error: function (str, flag) {
        //	error color: Red
        console.error("\u001B[31m" + new Date().toISOString() + ' [ERR] ' + "\t" + processInput(str) + "\u001B[0m");
        if (initialized && (undefined == flag || true === flag)) {
            filelogger.error(str);
        }
    },
    logDir: function () {
        return logDir;
    },
    logFile: function () {
        return `${logDir}/${logFileName}`;
    },
    errorFile: function () {
        return `${logDir}/${errorFileName}`;
    }
}

function processInput(param) {
    return 'string' == typeof param ? param : JSON.stringify(param);
}