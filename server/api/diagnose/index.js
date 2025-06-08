/**
 * 'api/logs': Diagnose API to GET logs data
 */

const fs = require('node:fs');
const path = require('node:path');
var express = require("express");
const authJwt = require('../jwt-helper');
var runtime;
var secureFnc;
var checkGroupsFnc;

module.exports = {
    init: function (_runtime, _secureFnc, _checkGroupsFnc) {
        runtime = _runtime;
        secureFnc = _secureFnc;
        checkGroupsFnc = _checkGroupsFnc;
    },
    app: function () {
        var diagnoseApp = express();
        diagnoseApp.use(function (req, res, next) {
            if (runtime.project) {
                next();
            } else {
                res.status(404).end();
            }
        });

        /**
         * GET Server logs folder content
         */
        diagnoseApp.get('/api/logsdir', secureFnc, function (req, res) {
            var groups = checkGroupsFnc(req);
            if (res.statusCode === 403) {
                runtime.logger.error("api get logsdir: Tocken Expired");
            } else if (authJwt.adminGroups.includes(groups)) {
                try {
                    var logPath = runtime.logger.logDir();
                    if (!fs.existsSync(logPath)) {
                        logPath = path.join(process.cwd(), runtime.logger.logDir());
                    }
                    var logFiles = fs.readdirSync(logPath);
                    res.json(logFiles);
                } catch (error) {
                    if (error.code) {
                        res.status(400).json({ error: error.code, message: error.message });
                    } else {
                        res.status(400).json({ error: "unexpected_error", message: error.toString() });
                    }
                    runtime.logger.error("api get logsdir: " + error.message);
                }
            } else {
                res.status(401).json({ error: "unauthorized_error", message: "Unauthorized!" });
                runtime.logger.error("api get logsdir: Unauthorized!");
            }
        });

        /**
         * GET Server logs data
         */
        diagnoseApp.get('/api/logs', secureFnc, function (req, res) {
            var groups = checkGroupsFnc(req);
            if (res.statusCode === 403) {
                runtime.logger.error("api get logs: Tocken Expired");
            } else if (authJwt.adminGroups.includes(groups)) {
                try {
                    var logFileName = req.query.file || 'fuxa.log';
                    var logPath = runtime.logger.logDir();
                    if (!fs.existsSync(logPath)) {
                        logPath = path.join(process.cwd(), runtime.logger.logDir());
                    }
                    var logFiles = fs.readdirSync(logPath);
                    let logFile = path.join(logPath, logFileName);
                    res.header('Content-Type', 'text/plain; charset=utf-8');
                    res.download(logFile, (err) => {
                        if (err) {
                            res.status(500).send({
                                message: "Could not download the file. " + err,
                            });
                            runtime.logger.error("api get logs: " + err);
                        }
                    });
                } catch (error) {
                    if (error.code) {
                        res.status(400).json({ error: error.code, message: error.message });
                    } else {
                        res.status(400).json({ error: "unexpected_error", message: error.toString() });
                    }
                    runtime.logger.error("api get logs: " + error.message);
                }
            } else {
                res.status(401).json({ error: "unauthorized_error", message: "Unauthorized!" });
                runtime.logger.error("api get logs: Unauthorized!");
            }
        });

        /**
         * POST testmail
         * Test SMTP send mail
         */
        diagnoseApp.post("/api/sendmail", secureFnc, function (req, res, next) {
            var groups = checkGroupsFnc(req);
            if (res.statusCode === 403) {
                runtime.logger.error("api post sendmail: Tocken Expired");
            } else if (authJwt.adminGroups.includes(groups) ) {
                if (req.body.params.smtp && !req.body.params.smtp.password && runtime.settings.smtp && runtime.settings.smtp.password) {
                    req.body.params.smtp.password = runtime.settings.smtp.password;
                }                
                runtime.notificatorMgr.sendMail(req.body.params.msg, req.body.params.smtp).then(function() {
                    res.end();
                }).catch(function(error) {
                    if (error.code) {
                        res.status(400).json({error:error.code, message: error.message});
                    } else {
                        res.status(400).json({error:"unexpected_error", message:error.toString()});
                    }
                    runtime.logger.error("api post sendmail: " + error.message);
                });
            } else {
                res.status(401).json({error:"unauthorized_error", message: "Unauthorized!"});
                runtime.logger.error("api post sendmail: Unauthorized");
            }
        });

        return diagnoseApp;
    }
}
